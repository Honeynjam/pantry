"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { Button } from "@pantry/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pantry/ui/components/tabs";
import { spring, useMotionTransition } from "@pantry/ui/lib/motion";
import { mcp } from "@/lib/content";

/** The MCP setup snippet per client, with copy. */
export function McpConfig() {
  return (
    <Tabs
      defaultValue={mcp.configs[0]!.id}
      className="border-border bg-gray-2 overflow-hidden rounded-xl border"
    >
      <div className="border-border flex items-center justify-between gap-2 border-b py-1.5 pr-1.5 pl-3">
        <span className="text-muted-foreground text-xs">{mcp.configTitle}</span>
        <TabsList>
          {mcp.configs.map((config) => (
            <TabsTrigger key={config.id} value={config.id}>
              {config.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {mcp.configs.map((config) => (
        <TabsContent key={config.id} value={config.id} className="relative">
          <pre className="text-gray-11 overflow-x-auto p-4 pr-12 font-mono text-xs leading-5">
            <code>{config.code}</code>
          </pre>
          <CopyButton text={config.code} className="absolute top-2.5 right-2.5" />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const swap = useMotionTransition(spring.snappy);
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={swap}
          className="flex"
        >
          {copied ? <Check /> : <Copy />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
