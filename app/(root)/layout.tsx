import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { checkSubscription } from "@/lib/subscription";
import { auth } from "@clerk/nextjs";
import prismadb from "@/lib/prismadb";

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const isPro = await checkSubscription();
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const conversations = await prismadb.conversation.findMany({
    where: {
      userId: userId,
      isDeleted: false,
    },
  });

  return (
    <div className="h-full">
      <Navbar isPro={isPro} hasChat={conversations.length > 0} />
      <div className="hidden md:flex h-full w-20 flex-col fixed inset-y-0 z-40">
        <Sidebar isPro={isPro} hasChat={conversations.length > 0} />
      </div>
      <main className="md:pl-20 pt-20 md:pt-0 h-full">{children}</main>
    </div>
  );
};

export default RootLayout;
