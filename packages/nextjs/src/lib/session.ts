import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  address?: string;
  role?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "cryptocampus-session",
  cookieOptions: {
    secure: false, // false para desarrollo local (no HTTPS)
    httpOnly: true,
    sameSite: "lax",
  },
};