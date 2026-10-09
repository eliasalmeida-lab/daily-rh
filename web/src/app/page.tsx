"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Entrada do site: manda para a Home (o guard do app cuida do login). */
export default function Root() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/home");
  }, [router]);
  return null;
}
