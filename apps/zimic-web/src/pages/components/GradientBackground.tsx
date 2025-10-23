function GradientBackground() {
  return (
    <div className="fixed inset-0 -z-1 overflow-hidden">
      <div
        className="bg-highlight-600/5 dark:bg-highlight-600/30 absolute -top-64 -right-64 -z-1 h-128 w-128 rounded-full"
        style={{ filter: 'blur(8rem)' }}
      />
      <div
        className="bg-highlight-500/5 dark:bg-highlight-500/10 absolute top-24 left-0 -z-1 h-128 w-128 rounded-full"
        style={{ filter: 'blur(8rem)' }}
      />
      <div
        className="bg-highlight-400/5 dark:bg-highlight-400/10 absolute right-8 bottom-36 -z-1 h-96 w-96 rounded-full"
        style={{ filter: 'blur(8rem)' }}
      />
      <div
        className="bg-highlight-300/5 dark:bg-highlight-300/15 absolute -bottom-64 left-32 -z-1 h-128 w-128 rounded-full"
        style={{ filter: 'blur(10rem)' }}
      />
    </div>
  );
}

export default GradientBackground;
