/**
 * Enhanced Intelligence Network Data Loader with Write Functionality
 * File Path: /docs/js/data-loader.js
 * 
 * Connects GitHub repository data to the game interfaces
 * Handles YAML parsing, GitHub API interactions, and file creation/updates
 */

class IntelligenceNetworkAPI {
    constructor(config = {}) {
        // GitHub repository configuration
        this.config = {
            owner: 'Amishman666',     // REPLACE WITH YOUR GITHUB USERNAME
            repo: 'intelligence-network',
            branch: 'main',
            githubToken: config.githubToken || null, // Required for write operations
            ...config
        };
        
        // Cache for loaded data
        this.cache = {
            assets: new Map(),
            operations: new Map(),
            gameState: null,
            intelligence: new Map(),
            lastUpdate: null
        };
        
        // GitHub API base URL
        this.apiBase = 'https://api.github.com';
        
        // Initialize YAML parser
        this.yamlParser = null;
        this.initializeYAMLParser();
        
        // Check for GitHub token in localStorage
        this.loadGitHubToken();
    }
    
    /**
     * Load GitHub token from localStorage
     */
    loadGitHubToken() {
        const savedToken = localStorage.getItem('intelligence_network_github_token');
        if (savedToken) {
            this.config.githubToken = savedToken;
        }
    }
    
    /**
     * Set GitHub token and save to localStorage
     */
    setGitHubToken(token) {
        this.config.githubToken = token;
        localStorage.setItem('intelligence_network_github_token', token);
    }
    
    /**
     * Initialize YAML parser
     */
    async initializeYAMLParser() {
        if (typeof jsyaml !== 'undefined') {
            this.yamlParser = jsyaml;
            return;
        }
        
        try {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
            script.onload = () => {
                this.yamlParser = jsyaml;
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Failed to load YAML parser:', error);
        }
    }
    
    /**
     * Check if write operations are available
     */
    canWrite() {
        return !!this.config.githubToken;
    }
    
    /**
     * Fetch file content from GitHub
     */
    async fetchFile(path) {
        const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        
        if (this.config.githubToken) {
            headers['Authorization'] = `token ${this.config.githubToken}`;
        }
        
        try {
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const content = atob(data.content.replace(/\s/g, ''));
            return { content, sha: data.sha, data };
            
        } catch (error) {
            console.error(`Failed to fetch file ${path}:`, error);
            throw error;
        }
    }
    
    /**
     * Create or update file in GitHub
     */
    async writeFile(path, content, message, sha = null) {
        if (!this.canWrite()) {
            throw new Error('GitHub token required for write operations');
        }
        
        const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        
        const payload = {
            message: message,
            content: btoa(unescape(encodeURIComponent(content))), // Handle UTF-8 properly
            branch: this.config.branch
        };
        
        // Include SHA for updates (not for new files)
        if (sha) {
            payload.sha = sha;
        }
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${this.config.githubToken}`,
            'Content-Type': 'application/json'
        };
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
            }
            
            const responseData = await response.json();
            console.log(`File ${path} ${sha ? 'updated' : 'created'} successfully`);
            return responseData;
            
        } catch (error) {
            console.error(`Failed to write file ${path}:`, error);
            throw error;
        }
    }
    
    /**
     * Generate unique asset ID
     */
    generateAssetId() {
        return `ASSET-${Date.now().toString().slice(-6)}`;
    }
    
    /**
     * Generate unique operation ID
     */
    generateOperationId() {
        return `OP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }
    
    /**
     * Create new asset file
     */
    async createAsset(assetData) {
        if (!this.canWrite()) {
            throw new Error('GitHub token required to create assets');
        }
        
        // Generate asset data with defaults
        const asset = {
            asset_id: assetData.asset_id || this.generateAssetId(),
            codename: assetData.codename || assetData.real_name || 'Unknown',
            real_name: assetData.real_name || 'Classified',
            classification: 'CONFIDENTIAL',
            recruited_date: new Date().toISOString().split('T')[0],
            recruited_by: 'Handler-Prime',
            
            description: assetData.description || '',
            background: assetData.background || '',
            image_url: assetData.image_url || '',
            
            location: {
                realm: assetData.location?.realm || 'Mortal Coil',
                region: assetData.location?.region || 'Unknown',
                specific_area: assetData.location?.specific_area || '',
                mobility: {
                    can_travel_realms: assetData.location?.mobility?.can_travel_realms || false,
                    travel_time_hours: assetData.location?.mobility?.travel_time_hours || 0,
                    requires_escort: assetData.location?.mobility?.requires_escort || false
                }
            },
            
            stats: {
                skill: parseInt(assetData.stats?.skill) || 5,
                stealth: parseInt(assetData.stats?.stealth) || 5,
                combat: parseInt(assetData.stats?.combat) || 5,
                tech: parseInt(assetData.stats?.tech) || 5,
                social: parseInt(assetData.stats?.social) || 5,
                will: parseInt(assetData.stats?.will) || 5
            },
            
            costs: {
                recruitment_fee: parseInt(assetData.costs?.recruitment_fee) || 5000,
                monthly_salary: parseInt(assetData.costs?.monthly_salary) || 2500,
                danger_bonus_multiplier: assetData.costs?.danger_bonus_multiplier || 1.2,
                realm_bonus: this.getRealmCostMultiplier(assetData.location?.realm) - 1
            },
            
            status: {
                current: 'available',
                since_date: new Date().toISOString().split('T')[0],
                availability_date: null,
                deployment_details: null
            },
            
            specializations: assetData.specializations || [],
            
            condition: {
                injury_level: 'none',
                injury_description: null,
                stat_penalties: {},
                recovery_date: null,
                medical_notes: null
            },
            
            equipment: assetData.equipment || [],
            
            psychological: {
                loyalty: parseInt(assetData.psychological?.loyalty) || 8,
                corruption_resistance: parseInt(assetData.psychological?.corruption_resistance) || 7,
                stress_tolerance: parseInt(assetData.psychological?.stress_tolerance) || 6,
                quirks: assetData.psychological?.quirks || []
            },
            
            mission_history: {
                total_missions: 0,
                success_rate: 0,
                failures: 0,
                injuries_sustained: 0,
                commendations: []
            },
            
            notes: assetData.notes || ''
        };
        
        // Generate filename
        const filename = `${asset.codename.toLowerCase().replace(/[^a-z0-9]/g, '_')}.yml`;
        const filePath = `data/assets/${filename}`;
        
        // Convert to YAML
        const yamlContent = this.yamlParser.dump(asset, { indent: 2 });
        
        // Create file in GitHub
        await this.writeFile(
            filePath,
            yamlContent,
            `Create new asset: ${asset.real_name} (${asset.codename})`
        );
        
        // Update cache
        this.cache.assets.set(asset.asset_id, asset);
        
        return asset;
    }
    
    /**
     * Create new operation file
     */
    async createOperation(operationData) {
        if (!this.canWrite()) {
            throw new Error('GitHub token required to create operations');
        }
        
        // Generate operation data with defaults
        const operation = {
            operation_id: operationData.operation_id || this.generateOperationId(),
            codename: operationData.codename || 'UNNAMED OPERATION',
            classification: operationData.classification || 'CLASSIFIED',
            created_date: new Date().toISOString().split('T')[0],
            created_by: 'Handler-Prime',
            priority: operationData.priority || 'MEDIUM',
            
            objective: {
                primary: operationData.objective?.primary || '',
                secondary: operationData.objective?.secondary || []
            },
            
            target: {
                location: {
                    realm: operationData.target?.location?.realm || 'Mortal Coil',
                    region: operationData.target?.location?.region || '',
                    specific: operationData.target?.location?.specific || ''
                },
                difficulty: parseInt(operationData.target?.difficulty) || 5,
                time_sensitivity: operationData.target?.time_sensitivity || 'MEDIUM'
            },
            
            requirements: {
                minimum_agents: parseInt(operationData.requirements?.minimum_agents) || 1,
                required_stats: {
                    skill: parseInt(operationData.requirements?.required_stats?.skill) || 0,
                    stealth: parseInt(operationData.requirements?.required_stats?.stealth) || 0,
                    combat: parseInt(operationData.requirements?.required_stats?.combat) || 0,
                    tech: parseInt(operationData.requirements?.required_stats?.tech) || 0,
                    social: parseInt(operationData.requirements?.required_stats?.social) || 0,
                    will: parseInt(operationData.requirements?.required_stats?.will) || 0
                },
                required_specializations: operationData.requirements?.required_specializations || [],
                restricted_realms: operationData.requirements?.restricted_realms || []
            },
            
            timeline: {
                estimated_duration_hours: parseInt(operationData.timeline?.estimated_duration_hours) || 24,
                deployment_window_start: operationData.timeline?.deployment_window_start || new Date().toISOString(),
                deployment_window_end: operationData.timeline?.deployment_window_end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            
            risks: {
                level: operationData.risks?.level || 'MEDIUM',
                factors: operationData.risks?.factors || [],
                consequences: {
                    failure: operationData.risks?.consequences?.failure || 'Mission failure',
                    partial_success: operationData.risks?.consequences?.partial_success || 'Limited intelligence gathered',
                    success: operationData.risks?.consequences?.success || 'Objectives completed'
                }
            },
            
            success_thresholds: {
                total_failure: '0-25',
                partial_1: '26-40',
                partial_2: '41-55',
                partial_3: '56-70',
                partial_4: '71-85',
                complete_success: '86-100'
            },
            
            intelligence_rewards: {
                partial_1: operationData.intelligence_rewards?.partial_1 || ['Basic intelligence gathered'],
                partial_2: operationData.intelligence_rewards?.partial_2 || ['Moderate intelligence gathered'],
                partial_3: operationData.intelligence_rewards?.partial_3 || ['Good intelligence gathered'],
                partial_4: operationData.intelligence_rewards?.partial_4 || ['Excellent intelligence gathered'],
                complete_success: operationData.intelligence_rewards?.complete_success || ['Complete intelligence package']
            },
            
            deployment: {
                status: operationData.deployment?.status || 'PLANNING',
                assigned_assets: [],
                deployment_date: null,
                expected_completion: null
            },
            
            results: {
                completion_date: null,
                success_level: null,
                intelligence_gathered: [],
                asset_status_changes: [],
                complications: [],
                handler_notes: null
            }
        };
        
        // Generate filename
        const filename = `${operation.codename.toLowerCase().replace(/[^a-z0-9]/g, '_')}.yml`;
        const filePath = `data/operations/${filename}`;
        
        // Convert to YAML
        const yamlContent = this.yamlParser.dump(operation, { indent: 2 });
        
        // Create file in GitHub
        await this.writeFile(
            filePath,
            yamlContent,
            `Create new operation: ${operation.codename}`
        );
        
        // Update cache
        this.cache.operations.set(operation.operation_id, operation);
        
        return operation;
    }
    
    /**
     * Update existing asset
     */
    async updateAsset(assetId, updates) {
        if (!this.canWrite()) {
            throw new Error('GitHub token required to update assets');
        }
        
        // Get current asset
        const asset = await this.getAsset(assetId);
        if (!asset) {
            throw new Error(`Asset ${assetId} not found`);
        }
        
        // Apply updates
        const updatedAsset = { ...asset, ...updates };
        
        // Generate filename from current asset
        const filename = asset._filename || `${asset.codename.toLowerCase().replace(/[^a-z0-9]/g, '_')}.yml`;
        const filePath = `data/assets/${filename}`;
        
        // Get current file SHA for update
        const { sha } = await this.fetchFile(filePath);
        
        // Convert to YAML
        const yamlContent = this.yamlParser.dump(updatedAsset, { indent: 2 });
        
        // Update file in GitHub
        await this.writeFile(
            filePath,
            yamlContent,
            `Update asset: ${updatedAsset.real_name} (${updatedAsset.codename})`,
            sha
        );
        
        // Update cache
        this.cache.assets.set(assetId, updatedAsset);
        
        return updatedAsset;
    }
    
    /**
     * Update existing operation
     */
    async updateOperation(operationId, updates) {
        if (!this.canWrite()) {
            throw new Error('GitHub token required to update operations');
        }
        
        // Get current operation
        const operation = await this.getOperation(operationId);
        if (!operation) {
            throw new Error(`Operation ${operationId} not found`);
        }
        
        // Apply updates
        const updatedOperation = { ...operation, ...updates };
        
        // Generate filename
        const filename = operation._filename || `${operation.codename.toLowerCase().replace(/[^a-z0-9]/g, '_')}.yml`;
        const filePath = `data/operations/${filename}`;
        
        // Get current file SHA for update
        const { sha } = await this.fetchFile(filePath);
        
        // Convert to YAML
        const yamlContent = this.yamlParser.dump(updatedOperation, { indent: 2 });
        
        // Update file in GitHub
        await this.writeFile(
            filePath,
            yamlContent,
            `Update operation: ${updatedOperation.codename}`,
            sha
        );
        
        // Update cache
        this.cache.operations.set(operationId, updatedOperation);
        
        return updatedOperation;
    }
    
    /**
     * Update game state
     */
    async updateGameState(updates) {
        if (!this.canWrite()) {
            throw new Error('GitHub token required to update game state');
        }
        
        // Get current game state
        const gameState = await this.loadGameState();
        
        // Apply updates (deep merge)
        const updatedGameState = this.deepMerge(gameState, updates);
        
        // Get current file SHA for update
        const { sha } = await this.fetchFile('data/game_state.yml');
        
        // Convert to YAML
        const yamlContent = this.yamlParser.dump(updatedGameState, { indent: 2 });
        
        // Update file in GitHub
        await this.writeFile(
            'data/game_state.yml',
            yamlContent,
            'Update game state',
            sha
        );
        
        // Update cache
        this.cache.gameState = updatedGameState;
        
        return updatedGameState;
    }
    
    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    /**
     * Get realm cost multiplier
     */
    getRealmCostMultiplier(realm) {
        const multipliers = {
            'Mortal Coil': 1.0,
            'Winter Court': 3.0,
            'Summer Court': 3.0,
            'Hell': 5.0,
            'Abyss': 8.0
        };
        return multipliers[realm] || 1.0;
    }
    
    /**
     * Parse YAML content
     */
    parseYAML(content) {
        if (!this.yamlParser) {
            throw new Error('YAML parser not initialized');
        }
        
        try {
            return this.yamlParser.load(content);
        } catch (error) {
            console.error('YAML parsing error:', error);
            throw error;
        }
    }
    
    /**
     * List files in a directory
     */
    async listDirectory(path) {
        const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        
        if (this.config.githubToken) {
            headers['Authorization'] = `token ${this.config.githubToken}`;
        }
        
        try {
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
            const files = await response.json();
            return files.filter(file => file.type === 'file' && file.name.endsWith('.yml'));
            
        } catch (error) {
            console.error(`Failed to list directory ${path}:`, error);
            return [];
        }
    }
    
    /**
     * Load all assets from the assets directory
     */
    async loadAssets(forceRefresh = false) {
        if (!forceRefresh && this.cache.assets.size > 0) {
            return Array.from(this.cache.assets.values());
        }
        
        try {
            const assetFiles = await this.listDirectory('data/assets');
            const assets = [];
            
            for (const file of assetFiles) {
                try {
                    const { content } = await this.fetchFile(file.path);
                    const assetData = this.parseYAML(content);
                    
                    // Add metadata
                    assetData._filename = file.name;
                    assetData._lastModified = file.sha;
                    
                    assets.push(assetData);
                    this.cache.assets.set(assetData.asset_id || file.name, assetData);
                    
                } catch (error) {
                    console.error(`Failed to load asset ${file.name}:`, error);
                }
            }
            
            console.log(`Loaded ${assets.length} assets`);
            return assets;
            
        } catch (error) {
            console.error('Failed to load assets:', error);
            return [];
        }
    }
    
    /**
     * Load all operations from the operations directory
     */
    async loadOperations(forceRefresh = false) {
        if (!forceRefresh && this.cache.operations.size > 0) {
            return Array.from(this.cache.operations.values());
        }
        
        try {
            const operationFiles = await this.listDirectory('data/operations');
            const operations = [];
            
            for (const file of operationFiles) {
                try {
                    const { content } = await this.fetchFile(file.path);
                    const operationData = this.parseYAML(content);
                    
                    // Add metadata
                    operationData._filename = file.name;
                    operationData._lastModified = file.sha;
                    
                    operations.push(operationData);
                    this.cache.operations.set(operationData.operation_id || file.name, operationData);
                    
                } catch (error) {
                    console.error(`Failed to load operation ${file.name}:`, error);
                }
            }
            
            console.log(`Loaded ${operations.length} operations`);
            return operations;
            
        } catch (error) {
            console.error('Failed to load operations:', error);
            return [];
        }
    }
    
    /**
     * Load game state
     */
    async loadGameState(forceRefresh = false) {
        if (!forceRefresh && this.cache.gameState) {
            return this.cache.gameState;
        }
        
        try {
            const { content } = await this.fetchFile('data/game_state.yml');
            const gameState = this.parseYAML(content);
            
            this.cache.gameState = gameState;
            this.cache.lastUpdate = new Date();
            
            console.log('Game state loaded');
            return gameState;
            
        } catch (error) {
            console.error('Failed to load game state:', error);
            
            // Return default game state
            return {
                game_info: {
                    campaign_name: "Shadows of Chicago",
                    current_date: new Date().toISOString().split('T')[0]
                },
                treasury: { current_funds: 500000 },
                security: { alert_level: "DEFCON 3" },
                network_stats: {
                    total_assets: 0,
                    available_assets: 0,
                    deployed_assets: 0,
                    active_operations: 0
                }
            };
        }
    }
    
    /**
     * Get specific asset by ID
     */
    async getAsset(assetId) {
        if (this.cache.assets.has(assetId)) {
            return this.cache.assets.get(assetId);
        }
        
        // Try to load all assets first
        await this.loadAssets();
        return this.cache.assets.get(assetId) || null;
    }
    
    /**
     * Get specific operation by ID
     */
    async getOperation(operationId) {
        if (this.cache.operations.has(operationId)) {
            return this.cache.operations.get(operationId);
        }
        
        // Try to load all operations first
        await this.loadOperations();
        return this.cache.operations.get(operationId) || null;
    }
    
    /**
     * Get assets by status
     */
    async getAssetsByStatus(status) {
        const assets = await this.loadAssets();
        return assets.filter(asset => 
            asset.status && asset.status.current === status
        );
    }
    
    /**
     * Get active operations
     */
    async getActiveOperations() {
        const operations = await this.loadOperations();
        return operations.filter(op => 
            op.deployment && op.deployment.status === 'ACTIVE'
        );
    }
    
    /**
     * Get operations by status
     */
    async getOperationsByStatus(status) {
        const operations = await this.loadOperations();
        return operations.filter(op => 
            op.deployment && op.deployment.status === status
        );
    }
    
    /**
     * Calculate network statistics
     */
    async calculateNetworkStats() {
        const [assets, operations] = await Promise.all([
            this.loadAssets(),
            this.loadOperations()
        ]);
        
        const stats = {
            total_assets: assets.length,
            available_assets: assets.filter(a => a.status?.current === 'available').length,
            deployed_assets: assets.filter(a => a.status?.current === 'deployed').length,
            injured_assets: assets.filter(a => a.status?.current === 'injured').length,
            captured_assets: assets.filter(a => a.status?.current === 'captured').length,
            active_operations: operations.filter(op => op.deployment?.status === 'ACTIVE').length,
            completed_operations: operations.filter(op => op.deployment?.status === 'COMPLETED').length,
            total_monthly_costs: assets.reduce((sum, asset) => 
                sum + (asset.costs?.monthly_salary || 0), 0
            )
        };
        
        return stats;
    }
    
    /**
     * Calculate mission timer remaining
     */
    calculateTimeRemaining(operation) {
        if (!operation.deployment?.expected_completion) {
            return null;
        }
        
        const completionTime = new Date(operation.deployment.expected_completion);
        const now = new Date();
        const remaining = completionTime - now;
        
        if (remaining <= 0) {
            return { expired: true, display: "MISSION COMPLETE" };
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        return {
            expired: false,
            hours,
            minutes, 
            seconds,
            display: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} REMAINING`
        };
    }
    
    /**
     * Get realm-specific information
     */
    getRealmInfo(realm) {
        const realmData = {
            'Mortal Coil': {
                dangerMultiplier: 1.0,
                costMultiplier: 1.0,
                icon: 'fas fa-city',
                color: '#00d4ff'
            },
            'Winter Court': {
                dangerMultiplier: 2.0,
                costMultiplier: 3.0,
                icon: 'fas fa-snowflake',
                color: '#87ceeb'
            },
            'Summer Court': {
                dangerMultiplier: 2.0,
                costMultiplier: 3.0,
                icon: 'fas fa-sun',
                color: '#ffa500'
            },
            'Hell': {
                dangerMultiplier: 3.0,
                costMultiplier: 5.0,
                icon: 'fas fa-fire',
                color: '#ff3366'
            },
            'Abyss': {
                dangerMultiplier: 4.0,
                costMultiplier: 8.0,
                icon: 'fas fa-skull',
                color: '#800080'
            }
        };
        
        return realmData[realm] || realmData['Mortal Coil'];
    }
    
    /**
     * Refresh all data
     */
    async refreshAllData() {
        this.cache.assets.clear();
        this.cache.operations.clear();
        this.cache.gameState = null;
        
        const [assets, operations, gameState] = await Promise.all([
            this.loadAssets(true),
            this.loadOperations(true),
            this.loadGameState(true)
        ]);
        
        console.log('All data refreshed');
        return { assets, operations, gameState };
    }
}

/**
 * UI Helper Functions
 */
class IntelligenceNetworkUI {
    constructor(api) {
        this.api = api;
        this.updateInterval = null;
    }
    
    /**
     * Format currency
     */
    formatCurrency(amount) {
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(0)}K`;
        } else {
            return `$${amount}`;
        }
    }
    
    /**
     * Get status badge HTML
     */
    getStatusBadge(status) {
        const statusMap = {
            available: { class: 'status-available', text: 'Available' },
            deployed: { class: 'status-deployed', text: 'Deployed' },
            injured: { class: 'status-injured', text: 'Injured' },
            captured: { class: 'status-captured', text: 'Captured' },
            dead: { class: 'status-dead', text: 'KIA' }
        };
        
        const statusInfo = statusMap[status] || statusMap.available;
        return `<span class="asset-status ${statusInfo.class}">${statusInfo.text}</span>`;
    }
    
    /**
     * Get realm icon HTML
     */
    getRealmIcon(realm) {
        const realmInfo = this.api.getRealmInfo(realm);
        return `<i class="${realmInfo.icon}" style="color: ${realmInfo.color}"></i>`;
    }
    
    /**
     * Start real-time updates
     */
    startRealTimeUpdates(interval = 30000) {
        this.stopRealTimeUpdates();
        
        this.updateInterval = setInterval(async () => {
            try {
                await this.updateTimers();
                await this.updateNetworkStats();
            } catch (error) {
                console.error('Real-time update failed:', error);
            }
        }, interval);
    }
    
    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    /**
     * Update mission timers in UI
     */
    async updateTimers() {
        const activeOperations = await this.api.getActiveOperations();
        
        activeOperations.forEach(operation => {
            const timerElement = document.querySelector(`[data-operation="${operation.operation_id}"] .timer-display`);
            if (timerElement) {
                const timeData = this.api.calculateTimeRemaining(operation);
                if (timeData) {
                    timerElement.innerHTML = `<i class="fas fa-hourglass-half"></i> ${timeData.display}`;
                    
                    if (timeData.expired) {
                        timerElement.style.color = '#ff3366';
                        timerElement.style.animation = 'pulse 1s infinite';
                    }
                }
            }
        });
    }
    
    /**
     * Update network statistics
     */
    async updateNetworkStats() {
        const stats = await this.api.calculateNetworkStats();
        const gameState = await this.api.loadGameState();
        
        // Update status bar
        const statusItems = {
            'active-assets': stats.total_assets,
            'operations': stats.active_operations,
            'treasury': this.formatCurrency(gameState.treasury?.current_funds || 0),
            'alert-level': gameState.security?.alert_level || 'DEFCON 3'
        };
        
        Object.entries(statusItems).forEach(([id, value]) => {
            const element = document.querySelector(`[data-status="${id}"] .status-value`);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    /**
     * Show GitHub token input modal
     */
    showTokenModal() {
        const modal = document.createElement('div');
        modal.id = 'tokenModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">GitHub Authentication Required</h3>
                </div>
                <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                    To create and edit assets/missions, you need a GitHub Personal Access Token with repository write permissions.
                </p>
                <div class="form-group">
                    <label class="form-label">GitHub Personal Access Token</label>
                    <input type="password" id="githubTokenInput" class="form-input" 
                           placeholder="ghp_xxxxxxxxxxxxxxxxxxxx">
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                        Create one at: GitHub Settings > Developer settings > Personal access tokens
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="saveGitHubToken()" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-save"></i> Save Token
                    </button>
                    <button onclick="closeTokenModal()" class="btn btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('githubTokenInput').focus();
    }
}

// Global instance - initialize when DOM is ready
let intelligenceAPI = null;
let intelligenceUI = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize with your GitHub repository details
    intelligenceAPI = new IntelligenceNetworkAPI({
        owner: 'your-username',     // Replace with your GitHub username
        repo: 'intelligence-network', // Replace with your repository name
        branch: 'main'              // Or 'master' if that's your default branch
    });
    
    intelligenceUI = new IntelligenceNetworkUI(intelligenceAPI);
    
    // Load initial data
    loadInitialData();
});

/**
 * GitHub Token Management
 */
function saveGitHubToken() {
    const token = document.getElementById('githubTokenInput').value.trim();
    if (token) {
        intelligenceAPI.setGitHubToken(token);
        closeTokenModal();
        alert('GitHub token saved successfully! You can now create and edit content.');
    } else {
        alert('Please enter a valid GitHub token.');
    }
}

function closeTokenModal() {
    const modal = document.getElementById('tokenModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Load and display initial data
 */
async function loadInitialData() {
    try {
        // Show loading state
        showLoadingState();
        
        // Load all data
        const [assets, operations, gameState] = await Promise.all([
            intelligenceAPI.loadAssets(),
            intelligenceAPI.loadOperations(), 
            intelligenceAPI.loadGameState()
        ]);
        
        // Populate UI
        await populateAssetRoster(assets);
        await populateOperationsBoard(operations);
        await updateDashboard(gameState);
        
        // Start real-time updates
        intelligenceUI.startRealTimeUpdates();
        
        // Hide loading state
        hideLoadingState();
        
        console.log('Intelligence Network initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize Intelligence Network:', error);
        showErrorState(error);
    }
}

/**
 * Populate asset roster
 */
async function populateAssetRoster(assets) {
    const container = document.querySelector('.asset-roster-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    assets.forEach(asset => {
        const realmInfo = intelligenceAPI.getRealmInfo(asset.location?.realm || 'Unknown');
        
        const assetCard = document.createElement('div');
        assetCard.className = 'asset-card';
        assetCard.innerHTML = `
            <div class="asset-header">
                <div class="asset-info">
                    <div class="asset-name">${asset.real_name || asset.codename}</div>
                    <div class="asset-location">
                        ${intelligenceUI.getRealmIcon(asset.location?.realm || 'Mortal Coil')} 
                        ${asset.location?.region || 'Unknown Location'}
                    </div>
                    <div class="asset-location">
                        <i class="fas fa-dollar-sign"></i> 
                        ${intelligenceUI.formatCurrency(asset.costs?.monthly_salary || 0)}/month
                    </div>
                </div>
                ${intelligenceUI.getStatusBadge(asset.status?.current || 'available')}
            </div>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">${asset.stats?.skill || 0}</span>
                    <span class="stat-label">Skill</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${asset.stats?.stealth || 0}</span>
                    <span class="stat-label">Stealth</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${asset.stats?.combat || 0}</span>
                    <span class="stat-label">Combat</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${asset.stats?.tech || 0}</span>
                    <span class="stat-label">Tech</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${asset.stats?.social || 0}</span>
                    <span class="stat-label">Social</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${asset.stats?.will || 0}</span>
                    <span class="stat-label">Will</span>
                </div>
            </div>
        `;
        
        container.appendChild(assetCard);
    });
}

/**
 * Populate operations board
 */
async function populateOperationsBoard(operations) {
    const container = document.querySelector('.operations-board-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const activeOperations = operations.filter(op => 
        op.deployment?.status === 'ACTIVE'
    );
    
    activeOperations.forEach(operation => {
        const timeRemaining = intelligenceAPI.calculateTimeRemaining(operation);
        
        const missionCard = document.createElement('div');
        missionCard.className = 'mission-card';
        missionCard.setAttribute('data-operation', operation.operation_id);
        missionCard.innerHTML = `
            <div class="mission-header">
                <div class="mission-title">${operation.codename}</div>
                <div class="mission-classification">${operation.classification}</div>
            </div>
            <div class="mission-details">
                <div class="detail-item">
                    <span class="detail-label">Target</span>
                    <span class="detail-value">${operation.objective?.primary || 'Classified'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Assets</span>
                    <span class="detail-value">${operation.deployment?.assigned_assets?.length || 0} Deployed</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Risk Level</span>
                    <div class="risk-meter">
                        <div class="risk-bars">
                            ${generateRiskBars(operation.risks?.level || 'MEDIUM')}
                        </div>
                        <span class="detail-value">${operation.risks?.level || 'MEDIUM'}</span>
                    </div>
                </div>
            </div>
            ${timeRemaining ? `
                <div class="timer-display">
                    <i class="fas fa-hourglass-half"></i> ${timeRemaining.display}
                </div>
            ` : ''}
        `;
        
        container.appendChild(missionCard);
    });
}

/**
 * Generate risk level bars
 */
function generateRiskBars(riskLevel) {
    const riskLevels = { 'LOW': 2, 'MEDIUM': 3, 'HIGH': 4, 'EXTREME': 5 };
    const activeCount = riskLevels[riskLevel] || 3;
    
    let bars = '';
    for (let i = 1; i <= 5; i++) {
        bars += `<div class="risk-bar ${i <= activeCount ? 'active' : ''}"></div>`;
    }
    return bars;
}

/**
 * Show/hide loading states
 */
function showLoadingState() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div style="text-align: center; color: var(--accent-blue);">
            <i class="fas fa-satellite-dish fa-spin fa-3x"></i>
            <p style="margin-top: 1rem; font-family: 'Orbitron', monospace;">
                ESTABLISHING SECURE CONNECTION...
            </p>
        </div>
    `;
    loadingOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(10, 11, 13, 0.9); z-index: 9999;
        display: flex; justify-content: center; align-items: center;
    `;
    document.body.appendChild(loadingOverlay);
}

function hideLoadingState() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function showErrorState(error) {
    hideLoadingState();
    
    const errorOverlay = document.createElement('div');
    errorOverlay.innerHTML = `
        <div style="text-align: center; color: var(--accent-red); max-width: 500px;">
            <i class="fas fa-exclamation-triangle fa-3x"></i>
            <h3 style="margin: 1rem 0; font-family: 'Orbitron', monospace;">
                CONNECTION FAILED
            </h3>
            <p style="margin-bottom: 1rem;">
                Unable to establish connection to intelligence network.
            </p>
            <p style="font-size: 0.9rem; color: var(--text-muted);">
                ${error.message}
            </p>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent-red); color: white; border: none; border-radius: 4px; cursor: pointer;">
                RETRY CONNECTION
            </button>
        </div>
    `;
    errorOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(10, 11, 13, 0.9); z-index: 9999;
        display: flex; justify-content: center; align-items: center; padding: 2rem;
    `;
    document.body.appendChild(errorOverlay);
}

/**
 * Update dashboard display
 */
async function updateDashboard(gameState) {
    const stats = await intelligenceAPI.calculateNetworkStats();
    
    // Update status bar values
    const statusMappings = {
        'active-assets': stats.total_assets,
        'operations': stats.active_operations, 
        'treasury': intelligenceUI.formatCurrency(gameState.treasury?.current_funds || 0),
        'alert-level': gameState.security?.alert_level || 'DEFCON 3'
    };
    
    Object.entries(statusMappings).forEach(([key, value]) => {
        const elements = document.querySelectorAll(`.status-item`);
        elements.forEach(item => {
            const label = item.querySelector('.status-label').textContent.toLowerCase();
            if (label.includes('assets') && key === 'active-assets') {
                item.querySelector('.status-value').textContent = value;
            } else if (label.includes('operations') && key === 'operations') {
                item.querySelector('.status-value').textContent = value;
            } else if (label.includes('treasury') && key === 'treasury') {
                item.querySelector('.status-value').textContent = value;
            } else if (label.includes('alert') && key === 'alert-level') {
                item.querySelector('.status-value').textContent = value;
            }
        });
    });
}
