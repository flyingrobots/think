import { after } from 'node:test';

import { closeAllNativeMemory } from '../../src/store/native-runtime.js';

after(closeAllNativeMemory);
