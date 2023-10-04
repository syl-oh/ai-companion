import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { UserWebhookEvent, UserJSON, User, SessionWebhookEvent, WebhookEvent } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs';
import { UserService } from '../../../domain/services/UserService'
import { WorkspaceService } from '../../../domain/services/WorkspaceService'
import { UserEntity } from '@/domain/entities/UserEntity';

enum SupportedEvents {
  USER_CREATED_EVENT = 'user.created',
  SESSION_CREATED_EVENT = 'session.created'
}

const isSupportedEvent = (eventType: string): eventType is SupportedEvents => {
  return Object.values(SupportedEvents).includes(eventType as SupportedEvents);
}

export async function POST(req: Request) {

  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!CLERK_WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload);

  // Create a new SVIX instance with your secret.
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    })
  }

  const data = evt.data;
  if (!isSupportedEvent(evt.type)) {
    console.log(`Unsupported event type: ${evt.type}`)
    return;
  }

  const eventType: SupportedEvents = evt.type;
  switch(eventType) {
    case SupportedEvents.USER_CREATED_EVENT:
      await handleUserCreatedEvent(evt as UserWebhookEvent);
      break;
    case SupportedEvents.SESSION_CREATED_EVENT:
      await handleSessionCreatedEvent(evt as SessionWebhookEvent);
      break;
  }

  return new Response('', { status: 201 })
}

async function handleUserCreatedEvent(userEvent: UserWebhookEvent) {
  const data = userEvent.data;
  const primaryEmail = getPrimaryEmailFromUserJson(data as UserJSON);
  if (primaryEmail === null) {
    console.log('Cannot extract primary email from user data: ' + JSON.stringify(data));
    return;
  }

  const userEntity = {
    externalId: data.id,
    email: primaryEmail
  };
  createUserAndAddToWorkspace(userEntity);
}

async function handleSessionCreatedEvent(sessionEvent: SessionWebhookEvent) {
  const data = sessionEvent.data;
  const userId = data.user_id;

  // Check if user already exists
  const userService = new UserService();
  const existingUser = await userService.findUserByExternalId(userId);
  if (existingUser !== null) {
    return;
  }

  // User does not exist, create user
  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail = getPrimaryEmailFromClerkUser(clerkUser);
  if (primaryEmail === null) {
    console.log('Cannot extract primary email from user data: ' + JSON.stringify(clerkUser));
    return;
  }

  const userEntity = {
    externalId: userId,
    email: primaryEmail
  };

  createUserAndAddToWorkspace(userEntity);
}


async function createUserAndAddToWorkspace(userEntity : UserEntity) {
  const userService = new UserService();
  const workspaceService = new WorkspaceService();

  const createdUserEntity = await userService.create(userEntity);
  workspaceService.addUserToNewOrExistingWorkspace(createdUserEntity);
}


const getPrimaryEmailFromUserJson  = (data: UserJSON): string | null => {
  const primaryEmailId = data.primary_email_address_id;
  const primaryEmail = data.email_addresses.find((emailAddress: any) => emailAddress.id === primaryEmailId);
  return primaryEmail ? primaryEmail.email_address : null;
}

const getPrimaryEmailFromClerkUser  = (clerkUser: User): string | null => {
  const primaryEmailId = clerkUser.primaryEmailAddressId;
  const primaryEmail = clerkUser.emailAddresses.find((emailAddress: any) => emailAddress.id === primaryEmailId);
  return primaryEmail ? primaryEmail.emailAddress : null;
}

