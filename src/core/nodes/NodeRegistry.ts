import { INodeDefinition } from '../types/node';

/**
 * Singleton registry for node definitions
 * This class manages all node type definitions in the application
 */
export class NodeRegistry {
  private static instance: NodeRegistry;
  private definitions: Map<string, INodeDefinition> = new Map();
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }
  
  /**
   * Register a node definition
   * @param definition The node definition to register
   */
  public register(definition: INodeDefinition): void {
    if (this.definitions.has(definition.type)) {
      console.warn(`Node definition '${definition.type}' already registered. Overwriting.`);
    }
    this.definitions.set(definition.type, definition);
  }
  
  /**
   * Register multiple node definitions
   * @param definitions Array of node definitions to register
   */
  public registerAll(definitions: INodeDefinition[]): void {
    definitions.forEach(def => this.register(def));
  }
  
  /**
   * Get a node definition by type
   * @param type The node type to retrieve
   * @returns The node definition or undefined if not found
   */
  public getDefinition(type: string): INodeDefinition | undefined {
    return this.definitions.get(type);
  }
  
  /**
   * Get all registered node definitions
   * @returns Array of all node definitions
   */
  public getAllDefinitions(): INodeDefinition[] {
    return Array.from(this.definitions.values());
  }
  
  /**
   * Get node definitions by category
   * @param category The category to filter by
   * @returns Array of node definitions in the specified category
   */
  public getDefinitionsByCategory(category: string): INodeDefinition[] {
    return Array.from(this.definitions.values())
      .filter(def => def.category === category);
  }
  
  /**
   * Get node definitions by system
   * @param system The system to filter by
   * @returns Array of node definitions in the specified system
   */
  public getDefinitionsBySystem(system: string): INodeDefinition[] {
    return Array.from(this.definitions.values())
      .filter(def => def.system === system);
  }
  
  /**
   * Check if a node type is registered
   * @param type The node type to check
   * @returns True if the node type is registered
   */
  public hasDefinition(type: string): boolean {
    return this.definitions.has(type);
  }
} 