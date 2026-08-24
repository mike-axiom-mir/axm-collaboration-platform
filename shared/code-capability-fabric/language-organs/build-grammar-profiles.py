#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ORGAN_ROOT = ROOT / "organs"
SCHEMA = "axm.code.language-grammar-profile.v1"
VERSION = "1.0.0"
KNOWLEDGE_VERSION = "2026-08-24.v1"

# broad mechanics only; every generated profile below is resolved and standalone.
CLASSES = {
    "markup": dict(scope="tree/containment", types="schema-or-element-kinds", mutation="structural-document", control="none", effects="embedding, references and host interpretation"),
    "data": dict(scope="tree/key-path", types="scalar/container/schema-driven", mutation="structural-data", control="none", effects="host coercion and consumer semantics"),
    "shell": dict(scope="process/function/dynamic", types="string/object-shell-dependent", mutation="environment/files/processes", control="branch, loop, pipeline and command status", effects="process, filesystem, environment and external command effects"),
    "query": dict(scope="statement/query/block", types="schema/domain-driven", mutation="query-or-transaction", control="set/relational/procedural by dialect", effects="database, graph, model or endpoint effects"),
    "build": dict(scope="file/block/target", types="host-dsl", mutation="build/configuration graph", control="declarative plus host expressions", effects="dependency resolution, build graph and generated outputs"),
    "static": dict(scope="lexical/module/type", types="compile-time static", mutation="language-defined mutable state", control="branch, loop, call, exception/result", effects="runtime plus foreign/system interfaces"),
    "dynamic": dict(scope="lexical/module/runtime", types="dynamic or inferred", mutation="runtime object/state", control="branch, loop, call, exception/result", effects="runtime plus dynamic dispatch/reflection where supported"),
    "functional": dict(scope="lexical/module", types="inferred/static-or-dynamic functional", mutation="prefer values; effects language-specific", control="expression, pattern, recursion and effect abstraction", effects="effect system/runtime/process model language-specific"),
    "hardware": dict(scope="design-unit/process/block", types="bit/vector/signal/domain-specific", mutation="signal/register/state transition", control="concurrent plus procedural regions", effects="simulation/synthesis timing and hardware connectivity"),
    "smart-contract": dict(scope="module/contract/function", types="static contract-domain", mutation="persistent ledger/storage plus local memory", control="branch/call/revert/result", effects="external calls, storage, value/assets and transaction context"),
    "special": dict(scope="grammar-defined", types="grammar-defined", mutation="grammar-defined", control="grammar-defined", effects="host/domain-defined"),
}

# languageId | class | paradigm | unit | constructs | dependency forms | high-risk transforms | verification focus | dialects/variants
DATA = r'''html|markup|markup document|document|element,attribute,text,comment,doctype|url reference,script src,stylesheet link|implicit end tags,raw-text elements,attribute escaping,DOM/source divergence|tree parse,HTML validator,browser structure|HTML5
python|dynamic|dynamic multi-paradigm|module|function,class,assignment,import,decorator,comprehension,context manager,async,match|import,from-import|indentation,descriptor/metaclass,dynamic import,monkey patch,eval/exec|AST parse,py_compile,tests|CPython,PyPy
javascript|dynamic|dynamic prototype/object|module or script|function,class,variable,import/export,closure,promise,async,generator,prototype|import,dynamic import,require|ASI,prototype mutation,dynamic property,eval,module mode|node syntax,lint,tests|ECMAScript,CommonJS,ESM
mr-placeholder|special|placeholder|file|placeholder||placeholder|placeholder|placeholder
typescript|static|gradual structural typing|module|function,class,interface,type alias,enum,namespace,generic,conditional type,mapped type|import,dynamic import,reference directive|declaration merging,type erasure,ambient declaration,structural compatibility|tsc noEmit,tests|TypeScript,TSX
css|markup|stylesheet cascade|stylesheet|rule,selector,declaration,at-rule,custom property,media query,container query,nesting|@import,url,font-face src|cascade order,specificity,custom-property cycles,vendor behavior|CSS parse,stylelint,render check|CSS2,CSS3,modern CSS
json|data|tree data|document|object,array,member,string,number,boolean,null||duplicate keys,number precision,ordering assumptions|JSON parse,schema when bound|RFC8259
yaml|data|indentation data graph|stream|document,mapping,sequence,scalar,anchor,alias,tag|host include when applicable|implicit typing,duplicate keys,anchor cycles,indentation|YAML parse,schema when bound|YAML1.1,YAML1.2
bash-posix-shell|shell|command shell|script|function,assignment,command,pipeline,subshell,command substitution,parameter expansion,heredoc,case|source,dot command|word splitting,globbing,quoting,set -e,pipeline status,eval|bash -n,shellcheck,tests|POSIX sh,Bash
powershell|shell|object pipeline shell|script or module|function,class,param,variable,pipeline,scriptblock,try/catch,foreach,switch|using module,Import-Module,dot-source|string expansion,pipeline object shape,dynamic invocation,scope drives|PowerShell parser,PSScriptAnalyzer,tests|Windows PowerShell,pwsh
sql|query|relational query|statement list|SELECT,CTE,DDL,DML,view,function,procedure,join,window,aggregate,transaction|table,view,function references|dialect drift,NULL semantics,implicit casts,transaction boundaries,identifier case|dialect parse,query tests,migration checks|ANSI SQL,vendor dialects
toml|data|configuration data|document|table,array-table,key/value,dotted key,inline table,date-time,multiline string||duplicate keys,table redefinition,date-time coercion|TOML parse,schema when bound|TOML1.0
docker|build|container build DSL|Dockerfile|instruction,stage,ARG,ENV,COPY,RUN,CMD,ENTRYPOINT|FROM image,COPY --from|secrets in layers,cache boundaries,shell expansion,base image drift|Dockerfile parse,build check,hadolint|Dockerfile
go|static|static concurrent systems|package|func,type,var,const,method,interface,generic,goroutine,channel,defer,select|import|goroutine leaks,data races,nil interface,defer order,unsafe,build tags|go compile,go vet,tests|Go
rust|static|ownership/trait systems|crate/module|fn,struct,enum,trait,impl,type,const,static,use,mod,borrow,lifetime,macro,async,match,unsafe|use,mod,extern crate|borrow semantics,unsafe boundaries,macro expansion,pinning,Send/Sync,drop order|rustc,cargo check,clippy,tests|Rust
csharp|static|managed static OO|compilation unit|class,struct,record,interface,enum,delegate,method,property,LINQ,async,pattern,generic,nullable|using,extern alias|nullable flow,reflection,dynamic,unsafe,async context,disposal|csc/dotnet build,analyzers,tests|C#
java|static|managed nominal OO|compilation unit|class,record,interface,enum,method,field,lambda,stream,annotation,sealed type,pattern,try-with-resources|import,module requires|type erasure,reflection,classloading,nullability,checked exceptions,synchronization|javac,static analysis,tests|Java
c|static|systems procedural|translation unit|function,struct,union,enum,typedef,variable,pointer,array,macro,preprocessor,goto|include|undefined behavior,pointer lifetime,integer overflow,macro expansion,aliasing,ownership conventions|cc syntax,warnings,sanitizers,tests|C89,C99,C11,C17,C23
cpp|static|systems generic OO|translation unit|function,class,struct,enum,template,namespace,RAII,lambda,concept,coroutine,operator overload,macro|include,module import|undefined behavior,lifetime,template instantiation,ODR,move semantics,exception safety,macro expansion|C++ syntax,warnings,sanitizers,tests|C++11,C++14,C++17,C++20,C++23
markdown|markup|lightweight markup|document|heading,paragraph,list,code fence,link,image,blockquote,table|link,image,reference link|dialect extensions,code fence language,reference links,embedded HTML|Markdown parse,link check,render check|CommonMark,GFM
xml|markup|namespaced markup|document|element,attribute,text,comment,CDATA,doctype,processing instruction|namespace,schema location,entity|entity expansion,namespace prefix,whitespace significance,encoding|XML parse,schema when bound|XML1.0,XML1.1
makefile|build|dependency build graph|makefile|target,rule,recipe,variable,define,conditional,phony,pattern rule,automatic variable|include|tab-sensitive recipes,shell expansion,recursive variables,parallel races,timestamp semantics|make dry-run,lint,build smoke|GNU Make,POSIX make
cmake|build|meta-build DSL|CMake file|command,function,macro,target,property,variable,generator expression,cache variable|include,add_subdirectory,find_package|configure vs generate,cache state,policy version,list/string semantics|cmake parse,configure smoke|CMake
github-actions|build|workflow orchestration DSL|workflow|workflow,job,step,matrix,expression,permission,environment,secret reference|uses action,reusable workflow,container image|YAML coercion,expression context,permission escalation,secret exposure,action pinning|YAML parse,workflow schema,actionlint|GitHub Actions
hcl-terraform|build|declarative infrastructure|configuration|block,attribute,resource,data,module,variable,output,locals,for expression,dynamic block,lifecycle|module source,provider,resource reference|state addresses,provider versions,replacement semantics,unknown values,sensitive data|HCL parse,terraform validate,plan review|HCL,Terraform
nix|functional|lazy functional configuration|expression file|binding,function,let,with,inherit,attribute set,derivation,recursion|import,flake input|lazy evaluation,impurity,store paths,override chains,infinite recursion|nix parse,eval check|Nix,flakes
kotlin|static|static JVM/multiplatform|file|class,data class,object,interface,function,property,coroutine,extension,sealed class,generic,nullability,delegation|import|nullability,coroutine context,inline/reified,platform types,delegation|kotlinc,detekt,tests|Kotlin JVM,Kotlin Multiplatform
php|dynamic|dynamic web/runtime OO|file|function,class,trait,interface,namespace,closure,generator,attribute,nullsafe,match,magic method|include,require,use|loose comparison,dynamic variables,include path,autoload,references|php lint,static analysis,tests|PHP7,PHP8
ruby|dynamic|dynamic message OO|file|class,module,method,constant,block,proc,lambda,mixin,metaprogramming,refinement,pattern|require,load,autoload|open classes,method_missing,eval,monkey patch,load path,symbol/string|ruby -c,rubocop,tests|Ruby
swift|static|value/protocol static|file/module|struct,class,enum,protocol,extension,func,property,optional,generic,async,actor,closure,result builder|import|value/reference boundaries,actor isolation,Sendable,memory ownership,optional unwrapping|swiftc parse,swiftlint,tests|Swift
dart|static|static app language|library|class,mixin,extension,enum,function,Future,Stream,async,isolate,null-safety,pattern,record|import,export,part|late init,null-safety,isolate boundaries,generated code,extension resolution|dart analyze,compile,tests|Dart
lua|dynamic|dynamic table/prototype|chunk|function,local,table,coroutine,metatable,closure,vararg,multiple return|require|global fallback,metatable magic,package path,nil semantics,numeric model|luac parse,lint,tests|Lua5.1,Lua5.2,Lua5.3,Lua5.4,LuaJIT
graphql|special|schema/query document|document|schema,type,interface,union,enum,input,directive,operation,fragment,selection set,variable|fragment spread,type reference|schema vs operation,nullable/list shape,fragment cycles,directive semantics|GraphQL parse,schema validate,operation validate|GraphQL
protocol-buffers|special|wire schema IDL|proto file|message,enum,service,rpc,field,oneof,package,option,reserved,map|import|wire compatibility,field number reuse,presence semantics,package renaming|protoc,compatibility checks|proto2,proto3,editions
json-schema|special|validation schema|schema document|schema,subschema,property,definition,reference,composition,conditional,format|$ref,$dynamicRef|draft dialects,reference resolution,annotation vs assertion,recursive refs|meta-schema validate,instance tests|draft-07,2019-09,2020-12
openapi|special|API contract schema|OpenAPI document|path,operation,parameter,request body,response,schema,component,security,callback,link|$ref,external docs,server|3.0 vs 3.1,schema dialect,ref resolution,operation id stability|OpenAPI validate,contract tests|OpenAPI3.0,OpenAPI3.1
bazel-starlark|build|hermetic build DSL|bzl/build file|rule,macro,function,load,target,attribute,select,provider,aspect,repository rule|load|analysis vs execution,label resolution,configuration transition,hermeticity|Starlark parse,bazel query/build smoke|Starlark,Bazel
gradle-dsl|build|host-language build DSL|build script|plugin,task,configuration,dependency,extension,repository,provider,source set,variant|plugin,dependency,include build|configuration vs execution,dynamic Groovy,plugin versions,dependency resolution|Gradle tasks,configuration cache check|Groovy DSL,Kotlin DSL
maven-pom|build|XML project model|project model|project,dependency,plugin,profile,property,module,repository,scope,dependency management,plugin execution|dependency,plugin,module,parent|effective POM,version ranges,transitives,profile activation|XML parse,maven validate,effective POM|Maven POM
kubernetes-manifests|build|resource declarative schema|manifest stream|resource,metadata,spec,status,selector,container,volume,probe,label,quantity|ConfigMap/Secret ref,service account,API object ref|API version,immutable fields,defaulting,server schema,secret data|YAML parse,kube schema,server dry-run|Kubernetes
helm-templates|build|Go-template plus YAML|chart template|template action,value reference,include,define,range,if,with,pipeline,YAML node|include,template,chart dependency|template/YAML duality,indentation,missing values,dot scope,rendered API version|helm template,YAML parse,kube schema|Helm3
ansible|build|automation playbook DSL|playbook/role|play,task,handler,role,block,variable,template,when,loop,register,delegate,become|role,collection,include,import|YAML coercion,idempotence,variable precedence,vault secrets,check mode|YAML parse,ansible syntax check,lint|Ansible
r|dynamic|dynamic statistical|script/package|function,assignment,formula,vector,data frame,S3 method,S4 class,promise,pipe|library,require,namespace|non-standard evaluation,recycling,NA vs NULL,factors,search path|R parse,lintr,tests|R
julia|dynamic|dynamic multiple dispatch|module|function,struct,abstract type,macro,module,multiple dispatch,broadcast,generated function,task|using,import|world age,type instability,mutation aliasing,macro hygiene,global performance|Julia parse,static checks,tests|Julia
scala|functional|static functional OO|source file|class,trait,object,enum,def,val,var,pattern,for comprehension,given/implicit,extension,higher-kinded type|import|implicit resolution,variance,initialization,effect model,binary compatibility|scalac,scalafix,tests|Scala2,Scala3
elixir|functional|dynamic functional actors|module|module,function,macro,protocol,defimpl,pattern,pipe,process,supervision,receive,with|alias,import,require,use|mailboxes,supervision,macro expansion,atom growth,protocol consolidation|elixirc,mix test,credo|Elixir
erlang|functional|dynamic functional actors|module|module,function,record,behaviour,pattern,receive,spawn,guard,list comprehension|include,include_lib,import|message ordering,links,hot code upgrade,atom growth,record shape|erlc,dialyzer,tests|Erlang
clojure|functional|dynamic persistent functional|namespace|ns,def,defn,defmacro,defrecord,deftype,persistent data,sequence,transducer,atom,ref,agent|require,use,import|macro expansion,dynamic vars,lazy sequences,nil semantics,STM|reader parse,clj-kondo,tests|Clojure
fsharp|functional|static functional .NET|file/module|module,namespace,type,record,union,let,member,pattern,computation expression,active pattern,async|open,reference|value restriction,type inference,computation expressions,mutability,interop null|F# check,dotnet build,tests|F#
ocaml|functional|static ML modules|compilation unit|module,module type,type,let,class,pattern,functor,variant,record,first-class module|open,include,module reference|type inference,module signatures,physical vs structural equality,mutable fields|ocamlc,dune,tests|OCaml
haskell|functional|lazy static functional|module|module,data,newtype,type,class,instance,function,lazy expression,typeclass,monad,pattern,guard|import|bottom/laziness,typeclass instances,language extensions,partial functions,space leaks|ghc -fno-code,hlint,tests|Haskell2010,GHC extensions
zig|static|static comptime systems|file/module|fn,const,var,struct,union,enum,error set,comptime,defer,errdefer,error union,optional,pointer|@import|comptime side effects,pointer lifetime,allocator ownership,undefined values,error unions|zig test no-exec,tests|Zig
webassembly-wat|special|typed stack bytecode text|module|module,func,type,table,memory,global,import,export,instruction,block,loop,branch,local|import|stack typing,index spaces,memory bounds,feature gates,import contracts|wat2wasm,wasm validate|WAT,Wasm features
assembly|special|architecture assembly|translation unit|label,section,directive,instruction,macro,register,memory operand,branch,call,stack|include,extern|ABI,calling convention,register clobber,alignment,relocation,architecture drift|assembler,objdump review,tests|x86,x86_64,ARM,AArch64,GAS,NASM
cuda|static|GPU C++|translation unit|kernel,device function,host function,thread index,shared memory,synchronization,memory space|include|races,divergence,bounds,host/device annotations,launch configuration|nvcc parse,compute sanitizer,tests|CUDA C++
opencl|static|GPU C dialect|translation unit|kernel,function,address space,work-item,work-group,barrier,vector type|include|address spaces,races,barrier divergence,bounds,version extensions|clang OpenCL parse,runtime tests|OpenCL C1.2,2.x,3.0
wgsl|special|WebGPU shader|shader module|function,struct,var,const,override,entry point,binding,address space,builtin,attribute,texture|none|binding layouts,stage interfaces,address spaces,uniformity,alignment|WGSL parse,validator,GPU tests|WGSL
glsl|special|graphics shader|shader|function,struct,uniform,buffer,in/out,layout,preprocessor,sampler,precision|host include|stage interfaces,precision,undefined behavior,version extensions,binding|glslang parse,SPIR-V validation,render tests|GLSL ES,desktop GLSL
hlsl|special|DirectX shader|shader|function,struct,cbuffer,resource,semantic,register,entry point,intrinsic,wave op|include|shader model,semantic interface,binding spaces,precision,matrix layout|DXC parse,DXIL/SPIR-V validation,render tests|HLSL shader models
objective-c|static|dynamic-runtime static OO|translation unit|interface,implementation,protocol,category,method,property,message send,selector,block,ARC|import,include|ARC ownership,runtime dispatch,selector strings,category collisions,bridging|clang Objective-C parse,static analyzer,tests|Objective-C,Objective-C++
groovy|dynamic|dynamic JVM|script/class|class,trait,method,property,closure,GString,operator overload,metaprogramming,AST transform|import|dynamic dispatch,GString expansion,metaClass,AST transforms,script binding|groovyc,CodeNarc,tests|Groovy
perl|dynamic|dynamic context-sensitive|file/module|sub,package,my/our/state,regex,reference,bless,tie,eval,wantarray|use,require|scalar/list context,symbol table,regex side effects,eval,string/number coercion|perl -c,perlcritic,tests|Perl5
matlab-octave|dynamic|dynamic matrix numeric|script/function file|function,classdef,property,method,matrix,cell,struct,handle,anonymous function,end indexing|import,path|shape,implicit expansion,1-based indexing,script workspace,handle/value semantics|parser,mlint/octave checks,numeric tests|MATLAB,Octave
fortran|static|static numeric/scientific|program unit|program,module,subroutine,function,type,interface,array,do,where,coarray,generic interface|use,include|implicit typing,array shape,kind,intent,aliasing,fixed/free form|gfortran syntax,warnings,tests|Fortran77,90,95,2003,2008,2018
cobol|static|business procedural|program|division,section,paragraph,data item,procedure,picture clause,perform,evaluate,file IO,decimal arithmetic|COPY|fixed format,picture scale,REDEFINES,copybook expansion,collating sequence|GnuCOBOL syntax,tests|COBOL85,GnuCOBOL
ada-spark|static|static safety/proof|compilation unit|package,procedure,function,type,task,protected,generic,range,subtype,exception,aspect|with,use|range checks,tasking,representation clauses,aliasing,proof/runtime distinction|GNAT compile,SPARK proof,tests|Ada2012,Ada2022,SPARK
visual-basic-dotnet|static|managed static OO|compilation unit|module,class,structure,interface,enum,Sub,Function,property,LINQ,async,lambda,Handles|Imports|Option Strict,default properties,late binding,ByRef,event handlers|VB compile,analyzers,tests|VB.NET
delphi-object-pascal|static|static Object Pascal|unit/program|program,unit,interface,implementation,class,record,procedure,function,property,set,variant|uses|ownership conventions,with scope,conditional compile,string mode,unit init order|Pascal compile,tests|Object Pascal,Delphi
common-lisp|functional|dynamic generic functional|file|defun,defmacro,defclass,defmethod,defpackage,reader macro,condition/restart,multiple values|require,ASDF dependency|reader macros,package symbols,dynamic binding,eval,macro expansion|reader parse,compile-file,tests|Common Lisp
scheme-racket|functional|dynamic functional|module/file|define,lambda,module,struct,syntax,continuation,tail call,parameter|require,provide|hygiene,continuations,dynamic-wind,reader language,mutable pairs|reader parse,Racket check,tests|Scheme,Racket
prolog|special|logic programming|module|fact,rule,directive,predicate,unification,backtracking,cut,DCG,meta-predicate|use_module,consult|cut semantics,negation-as-failure,variable scope,operators,termination|Prolog parse,query tests|ISO Prolog,SWI-Prolog
solidity|smart-contract|EVM smart contract|source unit|contract,interface,library,function,modifier,event,error,struct,enum,storage/memory/calldata,payable,fallback,assembly|import|reentrancy,storage layout,delegatecall,unchecked,upgradeability,external calls|solc,slither,tests|Solidity0.8
move|smart-contract|resource smart contract|module/script|module,script,struct,function,resource,ability,acquires,signer,generic,borrow|use,friend|resource linearity,abilities,global storage,friend visibility,addresses|Move compile,prover,tests|Move
vyper|smart-contract|restricted EVM smart contract|module|function,event,struct,interface,flag,storage,immutable,external/internal,payable,raw_call|import|reentrancy,storage layout,external calls,decimal/integer behavior,nonreentrant|Vyper compile,tests|Vyper0.4
nim|static|static metaprogrammed systems|module|proc,func,method,iterator,template,macro,type,generic,concept,pragma,ref object|import,include|macro expansion,GC/ARC/ORC,distinct types,template hygiene,unsafe|nim check,tests|Nim
crystal|static|inferred static Ruby-like|file|class,struct,module,def,macro,alias,enum,union type,block,fiber,channel,generic|require|nil unions,macro expansion,fiber scheduling,pointer unsafe,overload resolution|crystal no-codegen,tests|Crystal
d|static|static systems|module|module,function,class,struct,template,mixin,enum,range,scope guard,contract,CTFE|import|CTFE,mixin expansion,GC/manual memory,aliasing,version conditions|DMD/LDC compile,tests|D
v|static|static systems|module|fn,struct,interface,enum,type,const,option/result,sum type,generic,defer,go/comptime|import|autofree/GC,unsafe,option propagation,module visibility,comptime|v check,tests|V
raku|dynamic|dynamic multi-dispatch/grammar|compunit|sub,method,class,role,grammar,multi,junction,lazy sequence,regex grammar,promise,react|use,require|context,multi dispatch,grammar backtracking,dynamic variables,NativeCall|raku -c,tests|Raku
tcl|dynamic|command substitution language|script|proc,namespace,variable,command substitution,variable substitution,list,dict,uplevel,upvar|source,package require|substitution order,list quoting,eval,scope/upvar,string-list duality|Tcl parse,tests|Tcl
smalltalk|dynamic|image-based message OO|method/fileout|class,method,category,temporary,message send,block,cascade,primitive,metaclass|image/package dependency|image state,dynamic dispatch,become,global dictionary,method categories|parser,image tests|Smalltalk,Pharo/Squeak dialects
elm|functional|static pure functional UI|module|module,type,type alias,port,value,union,pattern,record,command,subscription,decoder|import|effect manager boundaries,port contracts,record update,JSON decoder assumptions|elm make,tests|Elm
purescript|functional|static pure functional effects|module|module,data,newtype,type,class,instance,foreign,row type,effect,do,pattern|import,foreign import|FFI boundaries,typeclass instances,effect rows,partiality,foreign representation|purs compile,tests|PureScript
rescript-reason|functional|static ML-to-JS|module/file|let,type,module,module type,external,variant,record,pattern,pipe,JSX|open,include,external|JS FFI,curried/uncurried,nullability,variant representation,generated JS|ReScript compile,tests|ReScript,Reason
gdscript|dynamic|dynamic/typed game script|script/class|class_name,extends,func,var,const,signal,enum,await,match,node path,annotation|extends,preload,load|scene-tree coupling,node paths,tool scripts,dynamic loads,engine API version|GDScript parse,Godot headless check,tests|GDScript4
qml|markup|declarative UI with JS|document|import,object,property,signal,function,binding,component,state,transition,JS block|import|binding loops,object lifetime,JS boundaries,property notify,module versions|QML parse,qmllint,render tests|QML
apex|static|cloud static OO|compilation unit|class,interface,enum,trigger,method,property,SOQL,SOSL,future,queueable,batch,annotation|namespace/package reference|governor limits,sharing,bulkification,transactions,dynamic SOQL,schema security|Apex parse,static analysis,tests|Salesforce Apex
abap|static|enterprise procedural/OO|program/class pool|report,class,interface,method,function,FORM,data,types,internal table,field-symbol,Open SQL|include,package namespace|implicit work areas,dynamic ASSIGN,authorization,database commit,include expansion|ABAPLint parse,syntax check,tests|ABAP
plsql|query|Oracle procedural SQL|unit|block,procedure,function,package,trigger,type,cursor,exception,bulk collect,FORALL,dynamic SQL|schema object reference|transactions,exception propagation,definer/invoker rights,dynamic SQL,NULL|PLSQL parse,database compile,tests|Oracle PL/SQL
tsql|query|SQL Server procedural SQL|batch|SELECT,CTE,DDL,DML,procedure,function,trigger,DECLARE,temp table,TOP,APPLY,TRY/CATCH,MERGE|object reference|batch GO,transactions,temp scope,implicit conversion,MERGE semantics,dynamic SQL|SQLFluff TSQL parse,database compile,tests|T-SQL
sparql|query|RDF graph query|query/update|SELECT,CONSTRUCT,ASK,DESCRIBE,PREFIX,BASE,INSERT,DELETE,triple pattern,property path,OPTIONAL,UNION,FILTER,BIND,SERVICE|IRI,prefix|blank-node scope,datasets,federation,unbound variables,datatypes|SPARQL parse,endpoint tests|SPARQL1.1
cypher|query|property graph query|statement|MATCH,OPTIONAL MATCH,CREATE,MERGE,DELETE,SET,REMOVE,UNWIND,CALL,RETURN,pattern,path,subquery|procedure,label/type reference|NULL semantics,cardinality,MERGE locking,variable scope,procedure side effects|Cypher parse,graph tests|openCypher,vendor Cypher
dax|query|tabular analytics expression|expression|measure,variable,function call,table expression,column reference,CALCULATE,FILTER,iterator,row/filter context|model table/column reference|row vs filter context,BLANK,relationships,context transition,implicit measures|ANTLR DAX parse,model tests|DAX
power-query-m|functional|lazy functional data query|section/expression|let,section,shared,function,record,list,table,type,each,try/otherwise,metadata|data-source function,section reference|lazy evaluation,privacy firewall,query folding,type annotations,null vs missing|Microsoft M parser,query tests|Power Query M
sas|special|statistical DATA/PROC DSL|program|DATA step,PROC,macro,LIBNAME,FILENAME,format,informat,retain,BY,array,macro variable,ODS,PROC SQL|include,libref,fileref|macro expansion,implicit DATA-step loop,missing values,format/informat,PDV|SAS parse,log check,tests|SAS
stata|special|command statistical DSL|do/ado file|command,program,macro,local,global,generate,replace,BY,foreach,forvalues,varlist,qualifier,factor/time-series operator|do,include,ado package|macro quoting,missing values,BY sort order,version prefixes,dataset state|Stata grammar,do-file tests|Stata
verilog|hardware|RTL hardware|source|module,primitive,function,task,parameter,wire,reg,instance,always,assign,generate,event control,delay,nonblocking assignment|include,module instance|blocking vs nonblocking,races,width/sign,timescale,implicit nets|Verilog parse,iverilog/verilator,simulation|Verilog2001,Verilog2005
systemverilog|hardware|RTL/verification hardware|source|module,interface,program,class,package,function,task,property,sequence,typedef,always_ff,always_comb,assertion,constraint,covergroup,clocking|include,import,module instance|races,4-state logic,randomization,clocking regions,packed/unpacked,UVM macros|SV parse,Verilator,simulation/formal|SystemVerilog
vhdl|hardware|concurrent hardware design|design file|entity,architecture,package,configuration,process,component,signal,variable,type,generic,port,generate,attribute|library,use,component binding|signal vs variable,delta cycles,resolved types,sensitivity,numeric packages|VHDL parse,GHDL,simulation|VHDL93,VHDL2008,VHDL2019
plc-structured-text|hardware|IEC61131 industrial control|POU file|PROGRAM,FUNCTION,FUNCTION_BLOCK,VAR block,type,method,property,IF,CASE,FOR,WHILE,FB call,timer,counter,edge|library-dependent type|scan cycle,retentive state,IO mapping,vendor extensions,safety state|IEC61131 Tree-sitter,PLC simulation|IEC61131-3 ST
ladder-logic|hardware|IEC61131 graphical control|PLCopen document|POU,network,contact,coil,block,variable,connection,series,parallel,set/reset,timer,counter,edge|function block reference|scan cycle,network order,retentive coil,IO address,vendor extensions|PLCopen XML parse,network validation,PLC simulation|IEC61131-3 LD,PLCopen XML
regex|special|pattern matcher|pattern|group,capture,alternation,quantifier,class,anchor,lookaround,backreference,named capture,inline flag|subpattern reference|catastrophic backtracking,engine dialect,Unicode,zero-width,replacement groups|engine compile,adversarial match tests|ECMAScript,PCRE,RE2,Python
tree-sitter-query|special|syntax-tree query|query|pattern,capture,predicate,field,anchor,alternation,quantifier,named node,anonymous node,directive|node-type reference,field reference|grammar version,node-name drift,capture collisions,predicate semantics|query compile,fixture match tests|Tree-sitter query'''


def csv_list(value: str):
    return [x.strip() for x in value.split(",") if x.strip()]


def parse_knowledge():
    out = {}
    for line in DATA.splitlines():
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) != 9:
            raise SystemExit(f"BAD_KNOWLEDGE_ROW:{line[:80]}:{len(parts)}")
        lid, cls, paradigm, unit, constructs, deps, hazards, verify, dialects = parts
        out[lid] = {
            "class": cls,
            "paradigm": paradigm,
            "unit": unit,
            "constructs": csv_list(constructs),
            "dependencies": csv_list(deps),
            "hazards": csv_list(hazards),
            "verification": csv_list(verify),
            "dialects": csv_list(dialects),
        }
    out.pop("mr-placeholder", None)
    return out


def canon(v):
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(v):
    return hashlib.sha256(canon(v).encode("utf-8")).hexdigest()


def profile_for(organ, hint):
    cls = CLASSES[hint["class"]]
    body = {
        "schema": SCHEMA,
        "version": VERSION,
        "knowledgeVersion": KNOWLEDGE_VERSION,
        "priority": organ["priority"],
        "organId": organ["organId"],
        "languageId": organ["languageId"],
        "displayName": organ["displayName"],
        "family": organ["family"],
        "kind": organ["kind"],
        "organDigest": organ["sha256"],
        "grammar": {
            "paradigm": hint["paradigm"],
            "compilationOrDocumentUnit": hint["unit"],
            "dialectsOrVariants": hint["dialects"],
            "constructs": hint["constructs"],
            "dependencyForms": hint["dependencies"],
            "scopeModel": cls["scope"],
            "typeModel": cls["types"],
            "mutationModel": cls["mutation"],
            "controlModel": cls["control"],
            "effectModel": cls["effects"],
        },
        "analysis": {
            "symbolInventory": hint["constructs"],
            "dependencyAnchors": hint["dependencies"],
            "semanticHazards": hint["hazards"],
            "requiredQuestionsBeforeRewrite": [
                "Which grammar/dialect/version is active?",
                "Which syntax nodes and dependency edges are affected?",
                "Does the change cross a scope, type, state, effect, ABI/schema, query, timing or host-language boundary?",
                "Which native or structural verifier can falsify the proposed rewrite?",
            ],
        },
        "rewritePolicy": {
            "blindTextRewrite": "FORBIDDEN",
            "unknownGrammarNode": "HOLD",
            "parseErrors": "HOLD",
            "preserveCommentsAndTriviaWhenAdapterSupportsIt": True,
            "requireDependencyImpactReview": bool(hint["dependencies"]),
            "highRiskTransforms": hint["hazards"],
            "capabilityIsNotAuthority": True,
        },
        "verification": {
            "focus": hint["verification"],
            "syntaxPassIsNotSemanticCorrectness": True,
            "fixturePassIsNotArbitraryProgramProof": True,
            "runtimeCorrectnessClaimed": False,
            "authority": "NONE",
        },
    }
    return {**body, "profileSha256": digest(body)}


def render(profile):
    return json.dumps(profile, indent=2, ensure_ascii=False) + "\n"


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = ap.parse_args()

    knowledge = parse_knowledge()
    organ_paths = sorted(ORGAN_ROOT.glob("*/organ.json"))
    if len(organ_paths) != 102:
        raise SystemExit(f"ORGAN_COUNT_NOT_102:{len(organ_paths)}")
    observed = []
    failures = []
    for organ_path in organ_paths:
        organ = json.loads(organ_path.read_text(encoding="utf-8"))
        lid = organ["languageId"]
        if lid not in knowledge:
            failures.append(f"MISSING_GRAMMAR_KNOWLEDGE:{lid}")
            continue
        profile = profile_for(organ, knowledge[lid])
        target = organ_path.with_name("grammar.profile.json")
        expected = render(profile)
        if args.write:
            target.write_text(expected, encoding="utf-8")
        elif not target.exists() or target.read_text(encoding="utf-8") != expected:
            failures.append(f"GRAMMAR_PROFILE_DRIFT:{lid}")
        observed.append({"languageId": lid, "profileSha256": profile["profileSha256"]})

    extras = sorted(set(knowledge) - {json.loads(p.read_text(encoding="utf-8"))["languageId"] for p in organ_paths})
    failures.extend(f"ORPHAN_GRAMMAR_KNOWLEDGE:{x}" for x in extras)
    if len(knowledge) != 102:
        failures.append(f"KNOWLEDGE_COUNT_NOT_102:{len(knowledge)}")
    if len({x["profileSha256"] for x in observed}) != len(observed):
        failures.append("DUPLICATE_PROFILE_DIGEST")

    summary = {
        "schema": "axm.code.language-grammar-profile-build-result.v1",
        "mode": "WRITE" if args.write else "CHECK",
        "organCount": len(organ_paths),
        "knowledgeCount": len(knowledge),
        "profileCount": len(observed),
        "uniqueProfileDigests": len({x["profileSha256"] for x in observed}),
        "failures": failures,
        "authority": "NONE",
    }
    print(json.dumps(summary, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
