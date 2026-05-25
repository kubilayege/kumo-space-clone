import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f14] px-6 text-center text-zinc-300">
      <h1 className="text-2xl font-semibold text-white">Space not found</h1>
      <p>This page does not exist in your virtual office.</p>
      <Link href="/" className="rounded-xl bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-400">
        Back to home
      </Link>
    </div>
  );
}
