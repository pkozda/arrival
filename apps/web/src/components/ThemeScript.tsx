export function ThemeScript() {
  const script = `(function(){try{document.documentElement.dataset.theme='dark';}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
