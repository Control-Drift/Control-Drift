/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DatabaseAdapter } from '../core.js';

export class FirebaseAdapter extends DatabaseAdapter {
    constructor(config) {
        super(config);
        this.type = 'firebase';
        this.endpoint = config.endpoint;
        this.apiKey = config.apiKey;
    }

    async checkAuth() {
        throw new Error('Firebase integration requires the official firebase SDK. Please implement this provider or use Custom REST.');
    }

    async fetchData(key) {
        throw new Error('Not implemented');
    }

    async saveData(key, data) {
        throw new Error('Not implemented');
    }
}
