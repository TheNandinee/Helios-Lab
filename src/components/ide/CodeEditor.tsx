"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { languageFor } from "@/sim/templates";
import { runSimulation } from "@/sim/controller";

const beforeMount: BeforeMount = (monaco) => {
  if (!monaco.languages.getLanguages().some((l) => l.id === "asm8051")) {
    monaco.languages.register({ id: "asm8051" });
    monaco.languages.setMonarchTokensProvider("asm8051", {
      ignoreCase: true,
      tokenizer: {
        root: [
          [/;.*$/, "comment"],
          [/^\s*[A-Za-z_]\w*:/, "type.identifier"],
          [/\b(MOV|MOVC|MOVX|ADD|ADDC|SUBB|INC|DEC|MUL|DIV|DA|ANL|ORL|XRL|CLR|CPL|RL|RLC|RR|RRC|SWAP|XCH|XCHD|PUSH|POP|SETB|JC|JNC|JB|JNB|JBC|ACALL|LCALL|CALL|RET|RETI|AJMP|LJMP|SJMP|JMP|JZ|JNZ|CJNE|DJNZ|NOP)\b/, "keyword"],
          [/\b(ORG|EQU|BIT|SET|DB|DW|END)\b/, "keyword.directive"],
          [/[@]R[01]|[@]A\+DPTR|[@]A\+PC/, "variable.predefined"],
          [/\b(A|B|C|AB|DPTR|R[0-7]|ACC|PSW|SP|DPL|DPH|P[0-3]|TMOD|TCON|TH[01]|TL[01]|IE|IP|SCON|SBUF|PCON|EA|ET0|ET1|EX0|EX1|TR0|TR1|TF0|TF1)\b/, "variable.predefined"],
          [/#?(0x[0-9a-f]+|[0-9][0-9a-f]*h|[01]+b|\d+)\b/, "number"],
          [/'[^']*'|"[^"]*"/, "string"],
        ],
      },
    });
  }
  monaco.editor.defineTheme("helios-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "38bdf8", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "c084fc" },
      { token: "variable.predefined", foreground: "fbbf24" },
      { token: "number", foreground: "34d399" },
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "type.identifier", foreground: "f472b6" },
    ],
    colors: { "editor.background": "#0b1020" },
  });
};

const onMount: OnMount = (editor, monaco) => {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => { runSimulation(); });
};

export default function CodeEditor() {
  const { files, activeFile, setFile, setActiveFile } = useLabStore(
    useShallow((s) => ({ files: s.files, activeFile: s.activeFile, setFile: s.setFile, setActiveFile: s.setActiveFile }))
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/60 px-2 pt-1">
        {Object.keys(files).map((name) => (
          <button
            key={name}
            onClick={() => setActiveFile(name)}
            className={`rounded-t px-3 py-1 text-xs ${name === activeFile ? "bg-[#0b1020] text-sky-300" : "text-slate-400 hover:text-white"}`}
          >
            {name}
          </button>
        ))}
        <span className="ml-auto pb-1 text-[10px] text-slate-500">⌘/Ctrl + Enter to run</span>
      </div>
      <div className="flex-1">
        <Editor
          path={activeFile}
          language={languageFor(activeFile)}
          value={files[activeFile] ?? ""}
          theme="helios-dark"
          beforeMount={beforeMount}
          onMount={onMount}
          onChange={(v) => setFile(activeFile, v ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, scrollBeyondLastLine: false, tabSize: 2 }}
        />
      </div>
    </div>
  );
}