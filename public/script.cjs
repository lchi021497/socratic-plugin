const highlighter = new Highlighter();
highlighter.run();

// Optional: Add event listeners for highlight events
highlighter.on('selection:create', ({ sources }) => {
    console.log('Created highlight:', sources);
});

highlighter.on('selection:remove', ({ sources }) => {
    console.log('Removed highlight:', sources);
});