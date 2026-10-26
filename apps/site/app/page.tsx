import {
  Agents,
  FinalCta,
  Hero,
  LeftOut,
  MacApp,
  Manifesto,
  SelfHost,
  SiteFooter,
  Speed,
} from "@/components/sections";
import { SiteNav } from "@/components/site-nav";
import { getStarCount } from "@/lib/github";

/** Light and dark bands alternate (plane.so): light for the product, dark for agents, the Mac and the close. */
export default async function Home() {
  const stars = await getStarCount();
  return (
    <>
      <SiteNav stars={stars} />
      <main>
        <Hero />
        <Manifesto />
        <Agents />
        <Speed />
        <MacApp />
        <SelfHost />
        <LeftOut />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
