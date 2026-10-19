import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Orbit — A little space to think bigger",
  description:
    "Your open AI workspace. Write, build, learn, and explore without signing in.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
