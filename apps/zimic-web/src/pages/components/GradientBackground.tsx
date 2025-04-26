function GradientBackground() {
  return (
    <div className="-z-1 fixed inset-0 overflow-hidden">
      <div className="bg-highlight-600/5 dark:bg-highlight-600/30 h-128 w-128 -z-1 absolute -right-64 -top-64 rounded-full blur-[8rem]" />
      <div className="bg-highlight-500/5 dark:bg-highlight-500/10 -z-1 h-128 w-128 absolute left-0 top-24 rounded-full blur-[8rem]" />
      <div className="bg-highlight-400/5 dark:bg-highlight-400/10 -z-1 absolute bottom-36 right-8 h-96 w-96 rounded-full blur-[8rem]" />
      <div className="bg-highlight-300/5 dark:bg-highlight-300/15 -z-1 h-128 w-128 absolute -bottom-64 left-32 rounded-full blur-[10rem]" />
    </div>
  );
}

export default GradientBackground;
