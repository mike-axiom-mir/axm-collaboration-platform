'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
const registry = require(path.join(repo, 'shared', 'code-capability-fabric', 'language-organs', 'registry.js'));
const organs = registry.all();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-code-toolchain-'));

function run(command, args = [], options = {}) {
  const started = Date.now();
  const r = spawnSync(command, args, {
    cwd: options.cwd || repo,
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeout || 15000,
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true
  });
  return {
    command,
    args,
    status: r.status,
    signal: r.signal,
    error: r.error ? String(r.error.message || r.error) : null,
    stdout: String(r.stdout || '').slice(0, 1600),
    stderr: String(r.stderr || '').slice(0, 1600),
    durationMs: Date.now() - started,
    ok: r.status === 0 && !r.error
  };
}

function which(command) {
  if (!/^[A-Za-z0-9._+\-]+$/.test(command)) return null;
  const r = run('which', [command], { timeout: 3000 });
  return r.ok ? r.stdout.trim().split(/\r?\n/)[0] || null : null;
}

function write(name, source) {
  const f = path.join(tmp, name);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, source, 'utf8');
  return f;
}

function fileProbe(probeClass, command, name, source, argsBuilder, options = {}) {
  return () => {
    const file = write(name, source);
    const result = run(command, argsBuilder(file), { ...options, cwd: options.cwd === 'tmp' ? tmp : options.cwd });
    return { probeClass, ...result };
  };
}

function commandProbe(probeClass, command, args, options = {}) {
  return () => ({ probeClass, ...run(command, args, options) });
}

const P = {
  html: fileProbe('FORMAT_PARSER', 'python3', 'probe.html', '<!doctype html><html><head><title>x</title></head><body><main>ok</main></body></html>\n', f => ['-c', `from html.parser import HTMLParser; p=HTMLParser(); p.feed(open(${JSON.stringify(f)},encoding="utf8").read()); p.close()`]),
  python: fileProbe('COMPILER_PARSE', 'python3', 'probe.py', 'def add(a, b):\n    return a + b\nassert add(2, 3) == 5\n', f => ['-m', 'py_compile', f]),
  javascript: fileProbe('COMPILER_PARSE', 'node', 'probe.js', "'use strict';\nconst add=(a,b)=>a+b; if(add(2,3)!==5) process.exit(1);\n", f => ['--check', f]),
  typescript: fileProbe('COMPILER_PARSE', 'tsc', 'probe.ts', 'const add=(a:number,b:number):number=>a+b; const n:number=add(2,3);\n', f => ['--pretty', 'false', '--noEmit', '--skipLibCheck', '--target', 'ES2020', f]),
  css: fileProbe('VALIDATOR', 'stylelint', 'probe.css', 'body { color: rgb(1 2 3); margin: 0; }\n', f => [f]),
  json: commandProbe('FORMAT_PARSER', 'node', ['-e', 'const x=JSON.parse("{\\"value\\":5}");if(x.value!==5)process.exit(1)']),
  yaml: commandProbe('FORMAT_PARSER', 'ruby', ['-e', 'require "yaml";x=YAML.safe_load("value: 5\\n");exit(x["value"]==5 ? 0 : 1)']),
  'bash-posix-shell': fileProbe('COMPILER_PARSE', 'bash', 'probe.sh', '#!/usr/bin/env bash\nset -eu\nx=$((2+3))\ntest "$x" -eq 5\n', f => ['-n', f]),
  powershell: fileProbe('COMPILER_PARSE', 'pwsh', 'probe.ps1', '$ErrorActionPreference="Stop"\nfunction Add-Probe([int]$a,[int]$b){$a+$b}\nif((Add-Probe 2 3)-ne 5){exit 1}\n', f => ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `$e=$null;$t=$null;[System.Management.Automation.Language.Parser]::ParseFile('${f.replace(/'/g, "''")}',[ref]$t,[ref]$e)|Out-Null;if($e.Count){exit 1}`]),
  sql: commandProbe('INTERPRETER_EXECUTION', 'sqlite3', [':memory:', 'CREATE TABLE t(x INTEGER);INSERT INTO t VALUES(5);SELECT x FROM t WHERE x=5;']),
  toml: commandProbe('FORMAT_PARSER', 'python3', ['-c', 'import tomllib;x=tomllib.loads("value = 5\\n");assert x["value"]==5']),
  docker: commandProbe('TOOL_AVAILABILITY', 'docker', ['--version']),
  go: fileProbe('COMPILER_PARSE', 'go', 'probe.go', 'package probe\nfunc add(a int,b int) int{return a+b}\n', f => ['tool', 'compile', '-o', path.join(tmp, 'go.o'), f]),
  rust: fileProbe('COMPILER_PARSE', 'rustc', 'probe.rs', 'fn add(a:i32,b:i32)->i32{a+b}\nfn main(){assert_eq!(add(2,3),5);}\n', f => ['--emit=metadata', '-o', path.join(tmp, 'rust.rmeta'), f]),
  csharp: commandProbe('TOOL_AVAILABILITY', 'dotnet', ['--info']),
  java: fileProbe('COMPILER_PARSE', 'javac', 'Probe.java', 'final class Probe{static int add(int a,int b){return a+b;}}\n', f => ['-d', tmp, f]),
  c: fileProbe('COMPILER_PARSE', 'cc', 'probe.c', 'static int add(int a,int b){return a+b;}int main(void){return add(2,3)==5?0:1;}\n', f => ['-std=c11', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', f]),
  cpp: fileProbe('COMPILER_PARSE', 'c++', 'probe.cpp', 'constexpr int add(int a,int b){return a+b;}static_assert(add(2,3)==5);int main(){return 0;}\n', f => ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', f]),
  markdown: fileProbe('FORMAT_PARSER', 'pandoc', 'probe.md', '# Title\n\nText **bold**.\n', f => ['--from=markdown', '--to=html', f, '-o', path.join(tmp, 'probe-md.html')]),
  xml: fileProbe('FORMAT_PARSER', 'python3', 'probe.xml', '<root><value>5</value></root>\n', f => ['-c', `import xml.etree.ElementTree as E;r=E.parse(${JSON.stringify(f)}).getroot();assert r.find("value").text=="5"`]),
  makefile: fileProbe('BUILD_DSL', 'make', 'Probe.mk', 'all:\n\t@echo ok\n', f => ['-n', '-f', f, 'all']),
  cmake: fileProbe('BUILD_DSL', 'cmake', 'probe.cmake', 'math(EXPR x "2 + 3")\nif(NOT x EQUAL 5)\nmessage(FATAL_ERROR "bad")\nendif()\n', f => ['-P', f]),
  'github-actions': fileProbe('VALIDATOR', 'actionlint', 'probe.yml', 'name: probe\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n', f => [f]),
  'hcl-terraform': fileProbe('CONFIG_PARSER', 'terraform', 'main.tf', 'locals { value = 5 }\noutput "value" { value = local.value }\n', () => ['validate', '-no-color'], { cwd: 'tmp' }),
  nix: fileProbe('CONFIG_PARSER', 'nix-instantiate', 'probe.nix', '{ value = 5; nested = { ok = true; }; }\n', f => ['--parse', f]),
  kotlin: fileProbe('COMPILER_PARSE', 'kotlinc', 'Probe.kt', 'fun add(a:Int,b:Int)=a+b\nfun main(){check(add(2,3)==5)}\n', f => [f, '-d', path.join(tmp, 'kotlin.jar')]),
  php: fileProbe('COMPILER_PARSE', 'php', 'probe.php', '<?php function add($a,$b){return $a+$b;} if(add(2,3)!==5){exit(1);}\n', f => ['-l', f]),
  ruby: fileProbe('COMPILER_PARSE', 'ruby', 'probe.rb', 'def add(a,b)=a+b\nraise unless add(2,3)==5\n', f => ['-c', f]),
  swift: fileProbe('COMPILER_PARSE', 'swiftc', 'probe.swift', 'func add(_ a:Int,_ b:Int)->Int{a+b}\nassert(add(2,3)==5)\n', f => ['-parse', f]),
  dart: fileProbe('COMPILER_PARSE', 'dart', 'probe.dart', 'int add(int a,int b)=>a+b; void main(){assert(add(2,3)==5);}\n', f => ['analyze', '--fatal-infos', '--fatal-warnings', f]),
  lua: fileProbe('COMPILER_PARSE', 'luac', 'probe.lua', 'local function add(a,b)return a+b end\nassert(add(2,3)==5)\n', f => ['-p', f]),
  'protocol-buffers': fileProbe('SCHEMA_COMPILER', 'protoc', 'probe.proto', 'syntax="proto3";package axm.probe;message Probe{string name=1;}\n', f => ['--descriptor_set_out=' + path.join(tmp, 'probe.pb'), '--proto_path=' + tmp, f]),
  'bazel-starlark': fileProbe('VALIDATOR', 'buildifier', 'BUILD.bazel', 'filegroup(name="probe",srcs=[])\n', f => ['-mode=check', f]),
  r: commandProbe('INTERPRETER_EXECUTION', 'Rscript', ['-e', 'f<-function(a,b)a+b;stopifnot(f(2,3)==5)']),
  julia: commandProbe('INTERPRETER_EXECUTION', 'julia', ['--startup-file=no', '-e', 'add(a,b)=a+b;@assert add(2,3)==5']),
  scala: fileProbe('COMPILER_PARSE', 'scalac', 'Probe.scala', 'object Probe{def add(a:Int,b:Int)=a+b}\n', f => ['-d', tmp, f]),
  elixir: fileProbe('COMPILER_PARSE', 'elixirc', 'probe.ex', 'defmodule Probe do\n def add(a,b),do:a+b\nend\n', f => ['--ignore-module-conflict', '-o', tmp, f]),
  erlang: fileProbe('COMPILER_PARSE', 'erlc', 'probe.erl', '-module(probe).\n-export([add/2]).\nadd(A,B)->A+B.\n', f => ['-o', tmp, f]),
  clojure: commandProbe('INTERPRETER_EXECUTION', 'clojure', ['-e', '(assert (= (+ 2 3) 5))']),
  ocaml: fileProbe('COMPILER_PARSE', 'ocamlc', 'probe.ml', 'let add a b=a+b\nlet ()=assert(add 2 3=5)\n', f => ['-c', f]),
  haskell: fileProbe('COMPILER_PARSE', 'ghc', 'Probe.hs', 'module Probe where\nadd::Int->Int->Int\nadd a b=a+b\n', f => ['-fno-code', '-Wall', f]),
  zig: fileProbe('COMPILER_PARSE', 'zig', 'probe.zig', 'fn add(a:i32,b:i32)i32{return a+b;}\ntest "add"{try @import("std").testing.expect(add(2,3)==5);}\n', f => ['test', '--test-no-exec', f]),
  assembly: fileProbe('ASSEMBLER', 'nasm', 'probe.asm', 'global probe\nsection .text\nprobe:\n mov eax,5\n ret\n', f => ['-f', 'elf64', '-o', path.join(tmp, 'probe.o'), f]),
  cuda: fileProbe('COMPILER_PARSE', 'nvcc', 'probe.cu', '__global__ void probe(int*x){x[0]+=1;}\nint main(){return 0;}\n', f => ['-c', '-o', path.join(tmp, 'probe-cuda.o'), f]),
  opencl: fileProbe('COMPILER_PARSE', 'clang', 'probe.cl', '__kernel void add(__global int*x){size_t i=get_global_id(0);x[i]+=1;}\n', f => ['-x', 'cl', '-cl-std=CL1.2', '-fsyntax-only', f]),
  'objective-c': fileProbe('COMPILER_PARSE', 'clang', 'probe.m', 'int add(int a,int b){return a+b;}int main(void){return add(2,3)==5?0:1;}\n', f => ['-x', 'objective-c', '-fsyntax-only', f]),
  groovy: fileProbe('COMPILER_PARSE', 'groovyc', 'Probe.groovy', 'int add(int a,int b){a+b}\nassert add(2,3)==5\n', f => ['-d', tmp, f]),
  perl: fileProbe('COMPILER_PARSE', 'perl', 'probe.pl', 'use strict;use warnings;sub add{$_[0]+$_[1]}die unless add(2,3)==5;\n', f => ['-c', f]),
  fortran: fileProbe('COMPILER_PARSE', 'gfortran', 'probe.f90', 'module probe\ncontains\ninteger function add(a,b)\ninteger,intent(in)::a,b\nadd=a+b\nend function\nend module\n', f => ['-fsyntax-only', f]),
  'ada-spark': fileProbe('COMPILER_PARSE', 'gnatmake', 'probe.adb', 'procedure Probe is\n function Add(A,B:Integer)return Integer is(A+B);\nbegin\n if Add(2,3)/=5 then raise Program_Error;end if;\nend Probe;\n', f => ['-q', '-c', f], { cwd: 'tmp' }),
  'common-lisp': commandProbe('INTERPRETER_EXECUTION', 'sbcl', ['--noinform', '--non-interactive', '--eval', '(assert (= (+ 2 3) 5))']),
  'scheme-racket': commandProbe('INTERPRETER_EXECUTION', 'racket', ['-e', '(unless (= (+ 2 3) 5) (exit 1))']),
  prolog: commandProbe('INTERPRETER_EXECUTION', 'swipl', ['-q', '-g', '(2+3=:=5)->halt(0);halt(1)']),
  nim: fileProbe('COMPILER_PARSE', 'nim', 'probe.nim', 'func add(a,b:int):int=a+b\nstatic:doAssert add(2,3)==5\n', f => ['check', '--hints:off', f]),
  crystal: fileProbe('COMPILER_PARSE', 'crystal', 'probe.cr', 'def add(a:Int32,b:Int32):Int32;a+b;end\nraise "bad" unless add(2,3)==5\n', f => ['build', '--no-codegen', f]),
  d: fileProbe('COMPILER_PARSE', 'dmd', 'probe.d', 'int add(int a,int b){return a+b;}static assert(add(2,3)==5);\n', f => ['-c', '-o-', f]),
  v: fileProbe('COMPILER_PARSE', 'v', 'probe.v', 'fn add(a int,b int)int{return a+b}\nfn main(){assert add(2,3)==5}\n', f => ['-check-syntax', f]),
  raku: fileProbe('COMPILER_PARSE', 'raku', 'probe.raku', 'sub add($a,$b){$a+$b};die unless add(2,3)==5;\n', f => ['-c', f]),
  tcl: () => ({ probeClass: 'INTERPRETER_EXECUTION', ...run('tclsh', [], { input: 'proc add {a b} { expr {$a+$b} }\nif {[add 2 3] != 5} { exit 1 }\nexit 0\n' }) }),
  'webassembly-wat': fileProbe('SCHEMA_COMPILER', 'wat2wasm', 'probe.wat', '(module(func(export "add")(param i32 i32)(result i32)local.get 0 local.get 1 i32.add))\n', f => [f, '-o', path.join(tmp, 'probe.wasm')]),
  regex: commandProbe('PATTERN_ENGINE', 'node', ['-e', 'const r=/^(axm)-([0-9]+)$/;if(!r.test("axm-52"))process.exit(1)'])
};

const results = organs.map(organ => {
  const candidates = organ.toolchainCandidates.map(name => ({ name, path: which(name) }));
  const available = candidates.filter(x => x.path);
  let smoke = null;
  const probe = P[organ.languageId];
  if (probe) {
    try { smoke = probe(); }
    catch (e) { smoke = { probeClass: 'HARNESS_ERROR', ok: false, status: null, signal: null, error: String(e && e.message ? e.message : e), stdout: '', stderr: '', durationMs: 0, command: null, args: [] }; }
  }
  return {
    priority: organ.priority,
    organId: organ.organId,
    languageId: organ.languageId,
    displayName: organ.displayName,
    execution: organ.execution,
    declaredCandidates: organ.toolchainCandidates,
    availableCandidates: available,
    pathToolchainPresent: available.length > 0,
    smokeDefined: !!probe,
    smokePass: !!(smoke && smoke.ok),
    smoke: smoke ? { probeClass: smoke.probeClass, command: smoke.command || null, args: smoke.args || [], status: smoke.status, signal: smoke.signal, error: smoke.error, durationMs: smoke.durationMs, stdout: smoke.stdout, stderr: smoke.stderr } : null
  };
});

const passing = results.filter(x => x.smokePass);
const summary = {
  schema: 'axm.code-language-toolchain-census/v2',
  status: 'TEST',
  organCount: results.length,
  toolchainPresentCount: results.filter(x => x.pathToolchainPresent).length,
  smokeDefinedCount: results.filter(x => x.smokeDefined).length,
  smokePassCount: passing.length,
  smokeFailCount: results.filter(x => x.smokeDefined && !x.smokePass).length,
  noSmokeDefinedCount: results.filter(x => !x.smokeDefined).length,
  compilerOrAssemblerPassCount: passing.filter(x => ['COMPILER_PARSE','ASSEMBLER','SCHEMA_COMPILER'].includes(x.smoke.probeClass)).length,
  parserValidatorInterpreterPassCount: passing.filter(x => ['FORMAT_PARSER','CONFIG_PARSER','VALIDATOR','INTERPRETER_EXECUTION','BUILD_DSL','PATTERN_ENGINE'].includes(x.smoke.probeClass)).length,
  toolAvailabilityOnlyPassCount: passing.filter(x => x.smoke.probeClass === 'TOOL_AVAILABILITY').length,
  compilerUniverseClaimed: false,
  runtimeCorrectnessClaimed: false,
  authority: 'NONE',
  passingOrgans: passing.map(x => x.languageId),
  failedSmokeOrgans: results.filter(x => x.smokeDefined && !x.smokePass).map(x => x.languageId),
  missingNativeProbe: results.filter(x => !x.smokeDefined).map(x => x.languageId)
};

const reportPath = process.env.AXM_TOOLCHAIN_REPORT || path.join(tmp, 'toolchain-census.json');
fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log(`AXM_TOOLCHAIN_REPORT=${reportPath}`);
if (results.length !== 102) process.exitCode = 2;
