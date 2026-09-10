import { motion, AnimatePresence } from "framer-motion";

export function LeaveConfirmationModal({ isOpen, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-neutral-50 mb-2">
              Quit Interview?
            </h3>
            <p className="text-sm text-neutral-400 mb-6">
              Your current interview progress will be lost. Are you sure you want to leave?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-neutral-300 hover:text-white border border-neutral-700 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Quit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
