import Image from "next/image";
import { type Avatar as AvatarKey, avatarSrc } from "@/lib/avatars";

/** A round avatar. Decorative by default, since a username sits next to it. */
export default function Avatar({
  avatar,
  size = 32,
  alt = "",
  className = "",
}: {
  avatar: AvatarKey;
  size?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <Image
      src={avatarSrc(avatar)}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 rounded-full bg-white ring-1 ring-black/10 dark:ring-white/15 ${className}`}
    />
  );
}
