"use client";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

interface Props {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const DataSourceCard: React.FC<Props> = ({
  title,
  description,
  href,
  icon,
}) => {
  const Icon = icon;
  return (
    <Link
      href={href}
      className="p-6 border rounded-xl flex flex-col justify-between bg-accent/50 hover:bg-primary/10"
    >
      <div>
        <Icon className="w-16 h-16" />
        <h2>{title}</h2>
        <p className="text-xs">{description}</p>
      </div>
      <div className="mt-4 text-ring">SELECT</div>
    </Link>
  );
};

export default DataSourceCard;
