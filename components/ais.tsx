import Image from "next/image";
import Link from "next/link";

import { StarRating } from "@/components/star-rating";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { AIDetailDto } from "@/src/domain/ports/api/AIApi";

interface AIsProps {
  data: AIDetailDto[];
}

export const AIs = ({ data }: AIsProps) => {
  if (data.length === 0) {
    return (
      <div className="pt-10 flex flex-col items-center justify-center space-y-3">
        <div className="relative w-60 h-60">
          <Image fill className="grayscale" src="/empty.png" alt="Empty" />
        </div>
        <p className="text-sm text-muted-foreground">No AIs found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-9 gap-3 pb-10">
      {data.map((item) => (
        <Card
          key={item.name}
          className="bg-card rounded-xl cursor-pointer hover:opacity-75 transition border-0 p-1"
        >
          <Link href={`/ai/${item.id}`}>
            <div className="h-full flex flex-col justify-between">
              <CardHeader className="flex">
                <div className="relative w-full h-56">
                  <Image
                    src={item.src}
                    fill
                    className="rounded-xl object-cover"
                    alt="Character"
                  />
                </div>
                <p className="font-bold">{item.name}</p>
                <p className="text-xs">{item.description}</p>
              </CardHeader>
              <CardFooter className="flex flex-col">
                <StarRating
                  value={Math.round(item.rating)}
                  count={item.ratingCount}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <div className="lowercase truncate w-11/12">
                    {item.userName}
                  </div>
                  <div className="flex items-center">{item.messageCount}</div>
                  <span>&nbsp;chats</span>
                </div>
              </CardFooter>
            </div>
          </Link>
        </Card>
      ))}
    </div>
  );
};
