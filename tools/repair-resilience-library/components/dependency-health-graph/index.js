"use strict";const {iso,sha256}=require("../common");
class DependencyHealthGraph{
 constructor(){this.nodes=new Map();this.edges=new Map();}
 addNode(id,health="UNKNOWN",evidence=[]){if(!id)throw new TypeError("id required");this.nodes.set(id,{id,health,evidence});if(!this.edges.has(id))this.edges.set(id,new Set());return this;}
 addDependency(consumer,dependency){if(!this.nodes.has(consumer))this.addNode(consumer);if(!this.nodes.has(dependency))this.addNode(dependency);this.edges.get(consumer).add(dependency);return this;}
 setHealth(id,health,evidence=[]){if(!this.nodes.has(id))this.addNode(id);this.nodes.set(id,{id,health:String(health).toUpperCase(),evidence});return this;}
 dependentsOf(id){const out=[];for(const [consumer,deps] of this.edges)if(deps.has(id))out.push(consumer);return out;}
 impactOf(id){const seen=new Set(),q=[id];while(q.length){const cur=q.shift();for(const d of this.dependentsOf(cur))if(!seen.has(d)){seen.add(d);q.push(d);}}return [...seen];}
 diagnose(id){const node=this.nodes.get(id);if(!node)return {state:"UNKNOWN_NODE"};const upstream=[...(this.edges.get(id)||[])].map(d=>this.nodes.get(d)).filter(n=>n&&["FAIL","WARN"].includes(n.health));let classification="HEALTHY_OR_UNKNOWN";if(node.health==="FAIL"&&upstream.length)classification="LOCAL_AND_UPSTREAM_FAILURE";else if(node.health==="FAIL")classification="LOCAL_FAILURE_CANDIDATE";else if(upstream.length)classification="UPSTREAM_FAILURE_CANDIDATE";return {node,upstreamIssues:upstream,classification,possibleImpact:this.impactOf(id),causalityClaimed:false};}
 report(){const nodes=[...this.nodes.values()].map(n=>this.diagnose(n.id));const out={schema:"axm.dependency-health.graph-report/v1",observedAt:iso(),nodes,edges:[...this.edges].flatMap(([c,ds])=>[...ds].map(d=>({consumer:c,dependency:d}))),authority:"OBSERVE_ONLY"};out.digest=sha256(out);return out;}
}
module.exports={DependencyHealthGraph};
