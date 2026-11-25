import { AnimatePresence, motion } from 'motion/react'

export default function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-0 bottom-8 z-50 mx-auto w-fit rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
