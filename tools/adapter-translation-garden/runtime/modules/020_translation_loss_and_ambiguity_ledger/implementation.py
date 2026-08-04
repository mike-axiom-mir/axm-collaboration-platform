from axm_translation_core import new_loss_ledger, add_loss, summarize_loss

def create():
    return new_loss_ledger()

def record(ledger, **entry):
    return add_loss(ledger, **entry)

def summarize(ledger):
    return summarize_loss(ledger)
