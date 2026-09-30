import React, { useState } from 'react';
import {
  FileCode,
  Folder,
  Copy,
  Check,
  Download,
  Terminal,
  ExternalLink,
  Code,
  Layers,
  Package,
  ShieldCheck,
  FileArchive,
  Hash,
  Server,
  Sparkles,
} from 'lucide-react';
import { PLUGIN_FILES, PluginFile } from '../services/pluginFiles';
import { COMPILED_ZIP_METADATA } from '../services/zipMetadata';

interface CodeExplorerProps {
  onDownloadZip: () => void;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({ onDownloadZip }) => {
  const [selectedFile, setSelectedFile] = useState<PluginFile | null>(null);
  const [isZipSelected, setIsZipSelected] = useState<boolean>(true); // Default to compiled zip package!
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredFiles = PLUGIN_FILES.filter((f) =>
    f.path.toLowerCase().includes(search.toLowerCase()) ||
    f.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyCode = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHash = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(type);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Group files by top-level category
  const categories = [
    { title: 'Core Bootstrap & Lifecycle', filter: (p: string) => !p.includes('includes/') },
    { title: 'Database & Activation', filter: (p: string) => p.includes('Activator') || p.includes('Deactivator') },
    { title: 'Models & Concurrency', filter: (p: string) => p.includes('Models/') },
    { title: 'Frontend Shortcodes & UI', filter: (p: string) => p.includes('Frontend/') },
    { title: 'Gateways & WooCommerce', filter: (p: string) => p.includes('Gateways/') },
    { title: 'Security & Monnify Services', filter: (p: string) => p.includes('Services/') },
    { title: 'Headless REST API Controllers', filter: (p: string) => p.includes('API/') },
    { title: 'WP Admin Interface', filter: (p: string) => p.includes('Admin/') },
  ];

  const lines = selectedFile ? selectedFile.content.split('\n') : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  WordPress Plugin Source & Compiled Distribution
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  <Sparkles className="w-3 h-3" />
                  ZIP Compiled
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {PLUGIN_FILES.length} production-ready PSR-4 PHP files, bundled and compiled into <code className="text-emerald-300 font-mono">public/faiiya-pay.zip</code> ({COMPILED_ZIP_METADATA.fileSizeFormatted}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/faiiya-pay.zip"
              download="faiiya-pay.zip"
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
              title="Direct link to static public/faiiya-pay.zip"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Direct Link</span>
            </a>
            <button
              onClick={onDownloadZip}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
            >
              <Download className="w-4 h-4" />
              <span>Download faiiya-pay.zip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Code Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Tree & Compiled ZIP selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
            {/* Special Compiled ZIP Package Card */}
            <button
              type="button"
              onClick={() => {
                setIsZipSelected(true);
                setSelectedFile(null);
              }}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                isZipSelected
                  ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-slate-950/70 border-emerald-500/40 text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <FileArchive className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-300">
                    {COMPILED_ZIP_METADATA.fileName}
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Compiled
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {COMPILED_ZIP_METADATA.fileSizeFormatted} &bull; {COMPILED_ZIP_METADATA.totalFiles} files bundled
                </div>
                <div className="text-[10px] text-emerald-400/80 font-mono mt-1">
                  Ready to install in WordPress &rarr;
                </div>
              </div>
            </button>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plugin files..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="max-h-[540px] overflow-y-auto space-y-4 pr-1">
              {categories.map((cat, idx) => {
                const files = filteredFiles.filter((f) => cat.filter(f.path));
                if (files.length === 0) return null;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-2 font-bold">
                      {cat.title}
                    </div>
                    {files.map((file) => {
                      const isSelected = !isZipSelected && selectedFile?.path === file.path;
                      return (
                        <button
                          key={file.path}
                          onClick={() => {
                            setSelectedFile(file);
                            setIsZipSelected(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-start gap-2 ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <FileCode className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs">{file.path}</div>
                            <div className="text-[10px] text-slate-500 truncate">{file.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer OR Compiled ZIP Package Hub (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {isZipSelected ? (
            /* Compiled ZIP Package Hub */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              {/* Header */}
              <div className="bg-slate-950/90 p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileArchive className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-bold font-mono text-white">
                        {COMPILED_ZIP_METADATA.fileName}
                      </h2>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Production Ready
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Compiled zip distribution archive containing all {COMPILED_ZIP_METADATA.totalFiles} PSR-4 plugin classes and shortcode templates.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onDownloadZip}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download ZIP ({COMPILED_ZIP_METADATA.fileSizeFormatted})</span>
                  </button>
                </div>
              </div>

              {/* Package Metadata Grid */}
              <div className="p-5 sm:p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">Archive Size</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-emerald-300 mt-0.5">
                      {COMPILED_ZIP_METADATA.fileSizeFormatted}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {COMPILED_ZIP_METADATA.fileSizeBytes.toLocaleString()} bytes
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">Bundled Files</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                      {COMPILED_ZIP_METADATA.totalFiles} Files
                    </div>
                    <div className="text-[10px] text-slate-500">Root folder: faiiya-pay/</div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">WordPress</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                      WP 6.x+
                    </div>
                    <div className="text-[10px] text-slate-500">WooCommerce 8.x+</div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">PHP Runtime</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                      7.4 &ndash; 8.3
                    </div>
                    <div className="text-[10px] text-slate-500">PSR-4 Autoloading</div>
                  </div>
                </div>

                {/* Cryptographic Hashes */}
                <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2.5">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cryptographic Integrity Hashes (Verification)</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">
                      <span className="text-slate-400">SHA-256:</span>
                      <span className="text-emerald-400 select-all truncate text-[11px]">
                        {COMPILED_ZIP_METADATA.sha256}
                      </span>
                      <button
                        onClick={() => handleCopyHash(COMPILED_ZIP_METADATA.sha256, 'sha256')}
                        className="text-slate-400 hover:text-white shrink-0 self-end sm:self-auto"
                      >
                        {copiedHash === 'sha256' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">
                      <span className="text-slate-400">MD5:</span>
                      <span className="text-slate-300 select-all truncate text-[11px]">
                        {COMPILED_ZIP_METADATA.md5}
                      </span>
                      <button
                        onClick={() => handleCopyHash(COMPILED_ZIP_METADATA.md5, 'md5')}
                        className="text-slate-400 hover:text-white shrink-0 self-end sm:self-auto"
                      >
                        {copiedHash === 'md5' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Direct Static Path / CLI Download */}
                <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Static Path & Direct URL:</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400">public/faiiya-pay.zip</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs font-mono text-slate-300">
                    <span className="truncate">curl -O {window.location.origin}/faiiya-pay.zip</span>
                    <button
                      onClick={() => handleCopyHash(`curl -O ${window.location.origin}/faiiya-pay.zip`, 'curl')}
                      className="text-slate-400 hover:text-white shrink-0 ml-2"
                    >
                      {copiedHash === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* WordPress Installation Steps */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    WordPress 1-Minute Installation Instructions:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-xl space-y-1">
                      <div className="font-bold text-emerald-400">Step 1: Download & Upload</div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Download <code className="text-slate-200">faiiya-pay.zip</code>. In WP Admin, go to <strong>Plugins &gt; Add New &gt; Upload Plugin</strong> and select the zip.
                      </p>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-xl space-y-1">
                      <div className="font-bold text-emerald-400">Step 2: Auto-Provisioning</div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Click <strong>Activate</strong>. The plugin creates custom MySQL tables (<code className="text-slate-200">faiiya_wallets</code>, <code className="text-slate-200">faiiya_transactions</code>, etc.) via <code className="text-emerald-300">dbDelta()</code>.
                      </p>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-xl space-y-1">
                      <div className="font-bold text-emerald-400">Step 3: Enable Gateway</div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Go to <strong>WooCommerce &gt; Settings &gt; Payments</strong> and enable <strong>Faiiya Pay Wallet</strong> for instant closed-loop customer checkouts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Archive Manifest */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">ZIP File Manifest ({PLUGIN_FILES.length} Files):</span>
                    <span className="text-[11px] text-slate-500 font-mono">Archive root: faiiya-pay/</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-850 font-mono text-xs max-h-[220px] overflow-y-auto">
                    {PLUGIN_FILES.map((f, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedFile(f);
                          setIsZipSelected(false);
                        }}
                        className="px-3.5 py-2 flex items-center justify-between hover:bg-slate-900 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 truncate">faiiya-pay/{f.path}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans shrink-0 ml-2">
                          View Code &rarr;
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Source Code Viewer */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              {/* Viewer Header */}
              <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsZipSelected(true)}
                    className="text-xs text-slate-400 hover:text-emerald-400 font-semibold mr-1"
                  >
                    &larr; Back to Package
                  </button>
                  <span className="text-slate-600">&bull;</span>
                  <span className="font-mono text-xs font-bold text-slate-200">
                    {selectedFile?.path}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {lines.length} lines
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>

              {/* Description Sub-bar */}
              <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 text-xs text-slate-400">
                {selectedFile?.description}
              </div>

              {/* Syntax Highlighted Code Box */}
              <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed text-slate-300">
                <table className="w-full">
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/60">
                        <td className="text-right pr-4 text-slate-600 select-none text-[11px] w-10 align-top">
                          {idx + 1}
                        </td>
                        <td className="whitespace-pre overflow-x-auto text-slate-200">
                          {line}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

