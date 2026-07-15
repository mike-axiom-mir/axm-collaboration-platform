'use strict';

class MappingService {
  constructor(registry) {
    this.registry = registry;
  }

  register(mapping, options) {
    return this.registry.registerMapping(mapping, options);
  }

  list() {
    return this.registry.list('mappings');
  }

  removeForRollback(mappingId) {
    return this.registry.removeMappingForRollback(mappingId);
  }
}

module.exports = { MappingService };
