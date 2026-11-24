"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useEffect } from "react";

type ToastType = "success" | "error" | "info";

export default function Toast({
  show,
  message,
  type = "info",
  onClose,
  duration = 3000,
}: {
  show: boolean;
  message: string;
  type?: ToastType;
  onClose?: () => void;
  duration?: number;
}) {
  // Auto dismiss
  useEffect(() => {
    if (!show || !onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [show, onClose, duration]);

  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-[#1ED760]" />,
      border: "border-[#1ED760]/30",
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-400" />,
      border: "border-red-400/30",
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-400" />,
      border: "border-blue-400/30",
    },
  };

  const current = config[type];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2
            flex items-center gap-3
            bg-[#111217]
            ${current.border}
            border
            text-white
            px-5 py-3
            rounded-xl
            shadow-[0_0_40px_rgba(0,0,0,0.4)]
            z-50
          `}
        >
          {current.icon}

          <span className="text-sm text-white/80">
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}