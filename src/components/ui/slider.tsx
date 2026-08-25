import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  trackClassName?: string
  rangeClassName?: string
  thumbClassName?: string
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, trackClassName, rangeClassName, thumbClassName, value, defaultValue, ...props }, ref) => {
  const thumbCount = value?.length ?? defaultValue?.length ?? 1
  return <SliderPrimitive.Root ref={ref} className={cn("relative flex w-full touch-none select-none items-center cursor-pointer", className)} {...(value ? { value } : {})} {...(defaultValue ? { defaultValue } : {})} {...props}>
    <SliderPrimitive.Track className={cn("relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20", trackClassName)}>
      <SliderPrimitive.Range className={cn("absolute h-full bg-primary", rangeClassName)} />
    </SliderPrimitive.Track>
    {Array.from({ length: thumbCount }).map((_, index) => <SliderPrimitive.Thumb key={index} className={cn("block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", thumbClassName)} />)}
  </SliderPrimitive.Root>
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
