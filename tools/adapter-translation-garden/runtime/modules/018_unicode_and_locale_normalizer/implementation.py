from __future__ import annotations
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_ALLOWED_FORMS = {'NFC', 'NFD', 'NFKC', 'NFKD'}


def normalize_text(text: str, *, form: str = 'NFC', casefold: bool = False, trim: bool = False) -> dict[str, Any]:
    if form not in _ALLOWED_FORMS:
        raise ValueError(f'unsupported Unicode normalization form: {form}')
    if not isinstance(text, str):
        raise TypeError('text must be a string')
    ledger = new_loss_ledger()
    result = unicodedata.normalize(form, text)
    transformations = []
    if result != text:
        transformations.append({'kind': 'unicode_normalization', 'form': form})
        add_loss(ledger, kind='unicode_representation_changed', path='$.text', source_value=text, target_value=result, reason=f'normalized using {form}', severity='medium' if form.startswith('NFK') else 'info', reversible=not form.startswith('NFK'))
    if casefold:
        folded = result.casefold()
        if folded != result:
            transformations.append({'kind': 'casefold'})
            add_loss(ledger, kind='case_distinction_removed', path='$.text', source_value=result, target_value=folded, reason='explicit Unicode casefold requested', severity='medium', reversible=False)
        result = folded
    if trim:
        trimmed = result.strip()
        if trimmed != result:
            transformations.append({'kind': 'trim'})
            add_loss(ledger, kind='boundary_whitespace_removed', path='$.text', source_value=result, target_value=trimmed, reason='explicit trim requested', severity='medium', reversible=False)
        result = trimmed
    return {
        'schema': 'axm.translation.normalized-text/v1', 'text': result,
        'original': text, 'changed': result != text, 'transformations': transformations,
        'loss': ledger, 'collision_risk': bool(casefold or form.startswith('NFK')) and result != text,
    }


def parse_number(text: str, *, decimal_separator: str = '.', group_separator: str | None = None) -> dict[str, Any]:
    if not isinstance(text, str):
        raise TypeError('number input must be text')
    if len(decimal_separator) != 1:
        raise ValueError('decimal_separator must be one character')
    if group_separator is not None and (len(group_separator) != 1 or group_separator == decimal_separator):
        raise ValueError('group separator must be one distinct character')
    raw = text.strip()
    if group_separator:
        parts = raw.split(decimal_separator)
        integer = parts[0]
        groups = integer.lstrip('+-').split(group_separator)
        if len(groups) > 1 and (not 1 <= len(groups[0]) <= 3 or any(len(g) != 3 for g in groups[1:])):
            raise ValueError('ambiguous or invalid grouping')
        raw = raw.replace(group_separator, '')
    if raw.count(decimal_separator) > 1:
        raise ValueError('multiple decimal separators')
    canonical = raw.replace(decimal_separator, '.')
    try:
        value = Decimal(canonical)
    except InvalidOperation as exc:
        raise ValueError('invalid localized number') from exc
    if not value.is_finite():
        raise ValueError('number must be finite')
    return {'schema': 'axm.translation.localized-number/v1', 'exact_decimal': str(value), 'canonical_text': format(value, 'f'), 'source_text': text, 'configuration': {'decimal_separator': decimal_separator, 'group_separator': group_separator}}


def normalize_identifier(text: str, *, form: str = 'NFC', case_sensitive: bool = True, trim: bool = False) -> dict[str, Any]:
    result = normalize_text(text, form=form, casefold=not case_sensitive, trim=trim)
    if result['text'] == '':
        raise ValueError('identifier may not become empty')
    result['schema'] = 'axm.translation.normalized-identifier/v1'
    result['case_sensitive'] = case_sensitive
    return result


def run(mode: str, **kwargs: Any) -> dict[str, Any]:
    if mode == 'text':
        return normalize_text(**kwargs)
    if mode == 'number':
        return parse_number(**kwargs)
    if mode == 'identifier':
        return normalize_identifier(**kwargs)
    raise ValueError(f'unsupported locale normalization mode: {mode}')
