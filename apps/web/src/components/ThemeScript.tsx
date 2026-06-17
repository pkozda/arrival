export function ThemeScript() {
  const script = `(function(){try{document.documentElement.dataset.theme='light';}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
