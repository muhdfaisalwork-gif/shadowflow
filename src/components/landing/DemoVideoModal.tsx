import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface DemoVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoVideoModal({ open, onOpenChange }: DemoVideoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 border-border">
        <DialogTitle className="sr-only">ShadowFlow Architecture Demo Video</DialogTitle>
        <DialogDescription className="sr-only">
          35-second narrated walkthrough of ShadowFlow visual DAG workflow automation, n8n import, and AI copilot.
        </DialogDescription>
        <video
          src="/demo-video.mp4"
          autoPlay
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg"
          onEnded={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
