from __future__ import annotations
import copy
import xml.etree.ElementTree as ET
from typing import Any


def _safe(text: str) -> None:
    upper=text.upper()
    if '<!DOCTYPE' in upper or '<!ENTITY' in upper: raise ValueError('DOCTYPE and ENTITY are refused')


def _node(element: ET.Element) -> dict[str, Any]:
    return {'tag':element.tag,'attributes':dict(element.attrib),'text':element.text,'children':[dict(_node(child),tail=child.tail) for child in list(element)]}


def _element(node: dict[str, Any]) -> ET.Element:
    element=ET.Element(node['tag'],{str(k):str(v) for k,v in node.get('attributes',{}).items()}); element.text=node.get('text')
    for child_node in node.get('children',[]):
        child=_element(child_node); child.tail=child_node.get('tail'); element.append(child)
    return element


def to_xml(tree: dict[str, Any]) -> str:
    return ET.tostring(_element(tree),encoding='unicode')


def inspect_xsd(xsd_text: str) -> dict[str, Any]:
    _safe(xsd_text); root=ET.fromstring(xsd_text); declarations=[]
    for element in root.iter():
        local=element.tag.split('}',1)[-1]
        if local in {'element','attribute','complexType','simpleType'} and element.get('name'):
            declarations.append({'kind':local,'name':element.get('name'),'type':element.get('type'),'min_occurs':element.get('minOccurs'),'max_occurs':element.get('maxOccurs'),'use':element.get('use')})
    return {'declarations':declarations,'validated':False,'external_resolution':False}


def run(xml_text: str, *, xsd_text: str | None = None) -> dict[str, Any]:
    try:
        _safe(xml_text); root=ET.fromstring(xml_text); tree=_node(root)
        xsd=inspect_xsd(xsd_text) if xsd_text is not None else None
    except (ValueError,ET.ParseError) as exc:
        return {'verdict':'REFUSE','reason':str(exc),'parsed':False}
    return {'schema':'axm.translation.xml-tree/v1','verdict':'PARSED','tree':tree,'xsd_inventory':xsd,'reconstructed_xml':to_xml(tree),'parsed':True,'source_preserved':xml_text}
