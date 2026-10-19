/** Keep in sync with the `users.avatar` CHECK in db/schema.sql. */
export const AVATARS = ["panda", "rabbit", "red_panda", "tiger", "turtle"] as const;

export type Avatar = (typeof AVATARS)[number];

export const AVATAR_LABELS: Record<Avatar, string> = {
  panda: "Panda",
  rabbit: "Rabbit",
  red_panda: "Red panda",
  tiger: "Tiger",
  turtle: "Turtle",
};

export function isAvatar(value: unknown): value is Avatar {
  return typeof value === "string" && (AVATARS as readonly string[]).includes(value);
}

/** Served from public/assets/avatars; every image is 512×512. */
export function avatarSrc(avatar: Avatar): string {
  return `/assets/avatars/avatar_${avatar}.png`;
}
