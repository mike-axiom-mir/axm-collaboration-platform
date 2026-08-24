'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
const organRoot = path.join(repo, 'shared', 'code-capability-fabric', 'language-organs', 'organs');
const registry = require(path.join(repo, 'shared', 'code-capability-fabric', 'language-organs', 'registry.js'));
const organs = registry.all();

function run(command, args = [], options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || repo,
    input: options.input || undefined,
    encoding: 'utf8',
    timeout: options.timeout || 15000,
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true
  });
  return {
    command,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout: String(result.stdout || '').slice(0, 1200),
    stderr: String(result.stderr || '').slice(0, 1200),
    durationMs: Date.now() - started,
    ok: result.status === 0 && !result.error
  };
}

function resolveCommand(command) {
  if (!/^[A-Za-z0-9._+\-]+$/.test(command)) return null;
  const found = run('which', [command], { timeout: 3000 });
  return found.ok ? found.stdout.trim().split(/\r?\n/)[0] || null : null;
}

function write(dir, name, text) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-language-probe-'));

const probes = {
  python: () => {
    const f = write(tmp, 'probe.py', 'def add(a, b):\n    return a + b\nassert add(2, 3) == 5\n');
    return run('python3', ['-m', 'py_compile', f]);
  },
  javascript: () => {
    const f = write(tmp, 'probe.js', "'use strict';\nconst add=(a,b)=>a+b; if(add(2,3)!==5) process.exit(1);\n");
    return run('node', ['--check', f]);
  },
  typescript: () => {
    const f = write(tmp, 'probe.ts', 'const add = (a: number, b: number): number => a + b;\nconst n: number = add(2, 3);\n');
    return run('tsc', ['--pretty', 'false', '--noEmit', '--skipLibCheck', '--target', 'ES2020', f]);
  },
  'bash-posix-shell': () => {
    const f = write(tmp, 'probe.sh', '#!/usr/bin/env bash\nset -eu\nx=$((2+3))\ntest "$x" -eq 5\n');
    return run('bash', ['-n', f]);
  },
  powershell: () => {
    const f = write(tmp, 'probe.ps1', '$ErrorActionPreference="Stop"\nfunction Add-Probe([int]$a,[int]$b){$a+$b}\nif((Add-Probe 2 3) -ne 5){exit 1}\n');
    return run('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `$null=[System.Management.Automation.Language.Parser]::ParseFile('${f.replace(/'/g, "''")}',[ref]$null,[ref]$null)`]);
  },
  sql: () => run('sqlite3', [':memory:', 'CREATE TABLE t(x INTEGER); INSERT INTO t VALUES(5); SELECT x FROM t WHERE x=5;']),
  toml: () => run('python3', ['-c', 'import tomllib; tomllib.loads("x = 5\\n[name]\\ny = \\\"ok\\\"\\n")']),
  docker: () => run('docker', ['--version']),
  go: () => {
    const f = write(tmp, 'probe.go', 'package probe\nfunc add(a int,b int) int { return a+b }\n');
    return run('go', ['tool', 'compile', '-o', path.join(tmp, 'probe-go.o'), f]);
  },
  rust: () => {
    const f = write(tmp, 'probe.rs', 'fn add(a:i32,b:i32)->i32{a+b}\nfn main(){assert_eq!(add(2,3),5);}\n');
    return run('rustc', ['--emit=metadata', '-o', path.join(tmp, 'probe-rust.rmeta'), f]);
  },
  java: () => {
    const f = write(tmp, 'Probe.java', 'final class Probe { static int add(int a,int b){return a+b;} }\n');
    return run('javac', ['-d', tmp, f]);
  },
  c: () => {
    const f = write(tmp, 'probe.c', 'static int add(int a,int b){return a+b;} int main(void){return add(2,3)==5?0:1;}\n');
    return run('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', f]);
  },
  cpp: () => {
    const f = write(tmp, 'probe.cpp', 'constexpr int add(int a,int b){return a+b;} static_assert(add(2,3)==5); int main(){return 0;}\n');
    return run('c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', f]);
  },
  makefile: () => {
    const f = write(tmp, 'Probe.mk', 'all:\n\t@echo ok\n');
    return run('make', ['-n', '-f', f, 'all']);
  },
  cmake: () => {
    const f = write(tmp, 'probe.cmake', 'math(EXPR x "2 + 3")\nif(NOT x EQUAL 5)\n  message(FATAL_ERROR "bad")\nendif()\n');
    return run('cmake', ['-P', f]);
  },
  ruby: () => {
    const f = write(tmp, 'probe.rb', 'def add(a,b) = a+b\nraise unless add(2,3)==5\n');
    return run('ruby', ['-c', f]);
  },
  php: () => {
    const f = write(tmp, 'probe.php', '<?php function add($a,$b){return $a+$b;} if(add(2,3)!==5){exit(1);}\n');
    return run('php', ['-l', f]);
  },
  swift: () => {
    const f = write(tmp, 'probe.swift', 'func add(_ a:Int,_ b:Int)->Int { a+b }\nassert(add(2,3)==5)\n');
    return run('swiftc', ['-parse', f]);
  },
  lua: () => {
    const f = write(tmp, 'probe.lua', 'local function add(a,b) return a+b end\nassert(add(2,3)==5)\n');
    return run('luac', ['-p', f]);
  },
  r: () => run('Rscript', ['-e', 'f <- function(a,b) a+b; stopifnot(f(2,3)==5)']),
  julia: () => run('julia', ['--startup-file=no', '-e', 'add(a,b)=a+b; @assert add(2,3)==5']),
  kotlin: () => {
    const f = write(tmp, 'Probe.kt', 'fun add(a:Int,b:Int)=a+b\nfun main(){check(add(2,3)==5)}\n');
    return run('kotlinc', [f, '-d', path.join(tmp, 'probe-kotlin.jar')]);
  },
  scala: () => {
    const f = write(tmp, 'Probe.scala', 'object Probe { def add(a:Int,b:Int)=a+b }\n');
    return run('scalac', ['-d', tmp, f]);
  },
  groovy: () => {
    const f = write(tmp, 'Probe.groovy', 'int add(int a,int b){a+b}\nassert add(2,3)==5\n');
    return run('groovyc', ['-d', tmp, f]);
  },
  perl: () => {
    const f = write(tmp, 'probe.pl', 'use strict; use warnings; sub add { $_[0]+$_[1] } die unless add(2,3)==5;\n');
    return run('perl', ['-c', f]);
  },
  fortran: () => {
    const f = write(tmp, 'probe.f90', 'module probe\ncontains\ninteger function add(a,b)\ninteger,intent(in)::a,b\nadd=a+b\nend function\nend module\n');
    return run('gfortran', ['-fsyntax-only', f]);
  },
  'ada-spark': () => {
    const f = write(tmp, 'probe.adb', 'procedure Probe is\n  function Add(A,B: Integer) return Integer is (A+B);\nbegin\n  if Add(2,3) /= 5 then raise Program_Error; end if;\nend Probe;\n');
    return run('gnatmake', ['-q', '-c', f], { cwd: tmp });
  },
  tcl: () => run('tclsh', ['-c', 'proc add {a b} { expr {$a+$b} }; if {[add 2 3] != 5} { exit 1 }']),
  'common-lisp': () => run('sbcl', ['--noinform', '--non-interactive', '--eval', '(assert (= (+ 2 3) 5))']),
  'scheme-racket': () => run('racket', ['-e', '(unless (= (+ 2 3) 5) (exit 1))']),
  prolog: () => run('swipl', ['-q', '-g', '(2+3=:=5)->halt(0);halt(1)']),
  nim: () => {
    const f = write(tmp, 'probe.nim', 'func add(a,b:int):int = a+b\nstatic: doAssert add(2,3)==5\n');
    return run('nim', ['check', '--hints:off', f]);
  },
  crystal: () => {
    const f = write(tmp, 'probe.cr', 'def add(a : Int32,b : Int32) : Int32; a+b; end\nraise "bad" unless add(2,3)==5\n');
    return run('crystal', ['build', '--no-codegen', f]);
  },
  d: () => {
    const f = write(tmp, 'probe.d', 'int add(int a,int b){return a+b;} static assert(add(2,3)==5);\n');
    return run('dmd', ['-c', '-o-', f]);
  },
  v: () => {
    const f = write(tmp, 'probe.v', 'fn add(a int,b int) int { return a+b }\nfn main(){ assert add(2,3)==5 }\n');
    return run('v', ['-check-syntax', f]);
  },
  raku: () => {
    const f = write(tmp, 'probe.raku', 'sub add($a,$b){$a+$b}; die unless add(2,3)==5;\n');
    return run('raku', ['-c', f]);
  },
  elixir: () => {
    const f = write(tmp, 'probe.ex', 'defmodule Probe do\n  def add(a,b), do: a+b\nend\n');
    return run('elixirc', ['--ignore-module-conflict', '-o', tmp, f]);
  },
  erlang: () => {
    const f = write(tmp, 'probe.erl', '-module(probe).\n-export([add/2]).\nadd(A,B)->A+B.\n');
    return run('erlc', ['-o', tmp, f]);
  },
  clojure: () => run('clojure', ['-e', '(assert (= (+ 2 3) 5))']),
  ocaml: () => {
    const f = write(tmp, 'probe.ml', 'let add a b = a + b\nlet () = assert (add 2 3 = 5)\n');
    return run('ocamlc', ['-c', f]);
  },
  haskell: () => {
    const f = write(tmp, 'Probe.hs', 'module Probe where\nadd :: Int -> Int -> Int\nadd a b = a+b\n');
    return run('ghc', ['-fno-code', '-Wall', f]);
  },
  zig: () => {
    const f = write(tmp, 'probe.zig', 'fn add(a:i32,b:i32)i32{return a+b;}\ntest "add" { try @import("std").testing.expect(add(2,3)==5); }\n');
    return run('zig', ['test', '--test-no-exec', f]);
  },
  assembly: () => {
    const f = write(tmp, 'probe.asm', 'global probe\nsection .text\nprobe:\n  mov eax, 5\n  ret\n');
    return run('nasm', ['-f', 'elf64', '-o', path.join(tmp, 'probe.o'), f]);
  },
  'objective-c': () => {
    const f = write(tmp, 'probe.m', 'int add(int a,int b){return a+b;} int main(void){return add(2,3)==5?0:1;}\n');
    return run('clang', ['-x', 'objective-c', '-fsyntax-only', f]);
  },
  opencl: () => {
    const f = write(tmp, 'probe.cl', '__kernel void add(__global int* x){ size_t i=get_global_id(0); x[i]+=1; }\n');
    return run('clang', ['-x', 'cl', '-cl-std=CL1.2', '-fsyntax-only', f]);
  },
  'webassembly-wat': () => {
    const f = write(tmp, 'probe.wat', '(module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))\n');
    return run('wat2wasm', [f, '-o', path.join(tmp, 'probe.wasm')]);
  },
  'protocol-buffers': () => {
    const f = write(tmp, 'probe.proto', 'syntax = "proto3"; package axm.probe; message Probe { string name = 1; }\n');
    return run('protoc', ['--descriptor_set_out=' + path.join(tmp, 'probe.pb'), '--proto_path=' + tmp, f]);
  },
  xml: () => {
    const f = write(tmp, 'probe.xml', '<root><value>5</value></root>\n');
    return run('python3', ['-c', `import xml.etree.ElementTree as E; E.parse(${JSON.stringify(f)})`]);
  },
  json: () => run('node', ['-e', 'const x=JSON.parse("{\\"value\\":5}"); if(x.value!==5) process.exit(1)']),
  yaml: () => run('ruby', ['-e', 'require "yaml"; x=YAML.safe_load("value: 5\\n"); exit(x["value"]==5 ? 0 : 1)']),
  markdown: () => run('ruby', ['-e', 's="# Title\\n\\nText"; exit(s.start_with?("# ") ? 0 : 1)']),
  regex: () => run('node', ['-e', 'const r=/^(axm)-([0-9]+)$/; if(!r.test("axm-52")) process.exit(1)'])
};

const results = [];
for (const organ of organs) {
  const candidates = organ.toolchainCandidates.map(name => ({ name, path: resolveCommand(name) }));
  const available = candidates.filter(x => x.path);
  let smoke = null;
  if (Object.prototype.hasOwnProperty.call(probes, organ.languageId)) {
    try {
      smoke = probes[organ.languageId]();
    } catch (error) {
      smoke = { ok: false, error: String(error && error.message ? error.message : error), status: null, signal: null, stdout: '', stderr: '', durationMs: 0 };
    }
  }
  results.push({
    priority: organ.priority,
    organId: organ.organId,
    languageId: organ.languageId,
    displayName: organ.displayName,
    execution: organ.execution,
    declaredCandidates: organ.toolchainCandidates,
    availableCandidates: available,
    pathToolchainPresent: available.length > 0,
    smokeDefined: !!smoke,
    smokePass: !!(smoke && smoke.ok),
    smoke: smoke ? {
      command: smoke.command || null,
      args: smoke.args || [],
      status: smoke.status,
      signal: smoke.signal,
      error: smoke.error,
      durationMs: smoke.durationMs,
      stdout: smoke.stdout,
      stderr: smoke.stderr
    } : null
  });
}

const summary = {
  schema: 'axm.code-language-toolchain-census/v1',
  status: 'TEST',
  organCount: results.length,
  toolchainPresentCount: results.filter(x => x.pathToolchainPresent).length,
  smokeDefinedCount: results.filter(x => x.smokeDefined).length,
  smokePassCount: results.filter(x => x.smokePass).length,
  smokeFailCount: results.filter(x => x.smokeDefined && !x.smokePass).length,
  noSmokeDefinedCount: results.filter(x => !x.smokeDefined).length,
  noDeclaredCandidateCount: results.filter(x => x.declaredCandidates.length === 0).length,
  runtimeCorrectnessClaimed: false,
  compilerUniverseClaimed: false,
  authority: 'NONE',
  tempRoot: path.basename(tmp),
  passingOrgans: results.filter(x => x.smokePass).map(x => x.languageId),
  failedSmokeOrgans: results.filter(x => x.smokeDefined && !x.smokePass).map(x => x.languageId),
  toolchainPresentWithoutSmoke: results.filter(x => x.pathToolchainPresent && !x.smokeDefined).map(x => x.languageId),
  missingToolchainCandidates: results.filter(x => !x.pathToolchainPresent).map(x => x.languageId)
};

const output = { summary, results };
const reportPath = process.env.AXM_TOOLCHAIN_REPORT || path.join(tmp, 'toolchain-census.json');
fs.writeFileSync(reportPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log(`AXM_TOOLCHAIN_REPORT=${reportPath}`);

if (results.length !== 102) process.exitCode = 2;
