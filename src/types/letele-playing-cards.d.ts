declare module "@letele/playing-cards" {
  import type { ComponentType, SVGProps } from "react";
  const components: Record<string, ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>>;
  export = components;
}
