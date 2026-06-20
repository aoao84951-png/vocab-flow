"use client";

import { useEffect, useState } from "react";

import MobileApp from "@/components/MobileApp";
import DesktopApp from "@/components/DesktopApp";

export default function Home() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => {
      window.removeEventListener("resize", checkScreen);
    };
  }, []);

  if (isDesktop === null) return null;

  return isDesktop ? <DesktopApp /> : <MobileApp />;
}
