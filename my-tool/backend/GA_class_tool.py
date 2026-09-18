import numpy as np
import matplotlib.pyplot as plt
import random
from FCM_class_tool import FCM
import FLT_class
import json
from copy import deepcopy


# class representing an individual in the population
# in this case an individual is a FCM (activation levels of the nodes)
class Individual(object):

    def __init__(self, genes=None, target_val=0.6, structure=None, activation_level=None, flt=None, number_used=False):
        self.target_val = target_val
        self.fitness_val = 0
        self.algorithm = None
        self.flt = flt if flt is not None else FLT_class.define_al_fuzzy()
        self.structure = structure
        self.activation_level = deepcopy(activation_level)
        active = {node['id'] for node in structure['nodes']
                  if node['role'] == 'intermediate'
                  and next(item for item in activation_level if item['id'] == node['id'])['enabled']}
        if not active:
            raise ValueError("At least one intermediate node must be enabled")
        connected = {edge['from'] for edge in structure['transitions'] if edge['to'] in active}
        self.final_nodes = [node['id'] for node in structure['nodes']
                            if node['role'] == 'final' and node['id'] in connected]
        for item in self.activation_level:
            value = item['weight']
            if isinstance(value, str):
                if value not in self.flt.linguistic_terms:
                    raise ValueError(f"Unknown activation term: {value}")
                value = self.flt.get_value(value)
            item['weight'] = float(value)
            if not 0 <= item['weight'] <= 1:
                raise ValueError("Activation levels must be between 0 and 1")
        initial = {item['id']: item['weight'] for item in self.activation_level}
        self.genes = {node_id: initial[node_id] for node_id in self.final_nodes}
        if genes is not None:
            if set(genes) != set(self.genes):
                raise ValueError("Genes must match the enabled final node IDs")
            self.genes = {node_id: float(value) for node_id, value in genes.items()}
            if any(not 0 <= value <= 1 for value in self.genes.values()):
                raise ValueError("Genes must be between 0 and 1")
        self.sync_activation_levels()
        self.number_used = True

    def sync_activation_levels(self):
        for item in self.activation_level:
            if item['id'] in self.genes:
                item['weight'] = self.genes[item['id']]

    # Returns fitness of individual
    # Fitness is the difference between target value and the calculated value
    def fitness(self, run=False):
        if run==True:
            self.algorithm = Algorithm(structure=self.structure, activation_level=self.activation_level, number_used=self.number_used, flt=self.flt)  # run the FCM algorithm
            computed_objective = self.algorithm.result

            self.fitness_val = round(float(abs(self.target_val - computed_objective)), 3)
        return self.fitness_val


# class representing the population
# in this case the population is an evolving set of individuals (FCMs with different activation levels)
class Population(object):

    def __init__(self, pop_size=10, crossover_prob=0.7, retain=5, target_val=0.6, individual_size = 30, structure=None, activation_level=None, to_remove=None, flt:FLT_class.Fuzzy_Linguistic_Terms=None):
        self.pop_size = pop_size
        self.individuals_size = individual_size
        self.crossover_prob = crossover_prob
        self.retain = retain
        self.target_val = target_val
        self.fitness_history = []
        self.ind_fitness_history = []
        self.parents = []
        self.elite = []
        self.to_remove = to_remove
        self.done = False
        if pop_size < 1 or not 0 < retain <= 100:
            raise ValueError("pop_size must be positive and retain must be in (0, 100]")
        if not 0 <= crossover_prob <= 1:
            raise ValueError("crossover_prob must be between 0 and 1")
        flt = flt if flt is not None else FLT_class.define_al_fuzzy()
        self.values = sorted({flt.get_value(x) for x in flt.linguistic_terms
                              if x != 'NA'})
        self.structure = structure
        self.activation_level = activation_level
        self.flt = flt

        # Create individuals
        self.individuals : list[Individual] = []
        for _ in range(pop_size):
            self.individuals.append(Individual(activation_level=self.activation_level, target_val=self.target_val, structure=self.structure, flt=flt))


    # Grade the generation by getting the average fitness of its individuals
    def grade(self, generation=None):
        fitness_sum = 0
        for x in self.individuals:
            fitness_sum += x.fitness(run=True)  # run the FCM algorithm
        fitness_sum = round(fitness_sum, 3)

        pop_fitness = round(fitness_sum / self.pop_size, 3)
        self.fitness_history.append(pop_fitness)

        # sort individuals by fitness (lower fitness it better in this case)
        self.individuals = sorted(self.individuals, key=lambda x: x.fitness())  # here x.fitness() does not run the FCM algorithm
        self.ind_fitness_history.append(self.individuals[0].fitness_val)

        # set done to True if the target value is reached or if the fitness is too low
        if pop_fitness < 0.03 or self.individuals[0].fitness_val==0 or self.individuals[0].fitness_val < 0.03:
            self.done = True

        if generation is not None:
            print(f"Generation: {generation}, Population fitness: {pop_fitness}, Fitness sum: {fitness_sum}, Best individual fitness: {self.individuals[0].fitness_val}")


    # select the fittest individuals (elitist selection) to be the parents of next generation (lower fitness it better in this case)
    def Select(self):
        # ELITIST SELECTION - keep the fittest as parents for next gen
        retain_length = (self.retain/100) * len(self.individuals)
        self.parents = self.individuals[:max(1, int(retain_length))]
        self.elite = self.parents[:] # keep a *copy* of the fittest individuals

    @staticmethod
    def extract_genes(idx_crossover, parent1 : Individual, parent2 : Individual):
        new_genes = {}

        for gene_id in parent1.genes.keys():
            if gene_id not in parent1.final_nodes:
                new_genes[gene_id] = parent1.genes[gene_id]
        
        parent_genes_final = deepcopy(parent1.final_nodes)
        random.shuffle(parent_genes_final)

        parent1_genes_final = parent_genes_final[:idx_crossover]
        for gene_id in parent1_genes_final:
            new_genes[gene_id] = parent1.genes[gene_id]

        parent2_genes_final = parent_genes_final[idx_crossover:]
        for gene_id in parent2_genes_final:
            new_genes[gene_id] = parent2.genes[gene_id]

        return new_genes

    # crossover the parents to generate a new generation of individuals
    def Crossover(self):
        children = self.elite[:]
        while len(children) < self.pop_size:
            father = random.choice(self.parents)
            mother = random.choice(self.parents)
            if random.random() < self.crossover_prob and father.final_nodes:
                index = random.randint(0, len(father.final_nodes))
                genes = self.extract_genes(index, father, mother)
            else:
                genes = dict(father.genes)
            children.append(Individual(genes=genes, target_val=self.target_val,
                                       structure=self.structure, activation_level=self.activation_level,
                                       flt=self.flt, number_used=True))
        self.individuals = children

    def Mutation(self):
        for individual in self.individuals:
            if any(individual is elite for elite in self.elite):
                continue
            candidates = {node_id: [value for value in self.values if value > current]
                          for node_id, current in individual.genes.items()}
            candidates = {node_id: values for node_id, values in candidates.items() if values}
            if candidates:
                node_id = random.choice(list(candidates))
                individual.genes[node_id] = random.choice(candidates[node_id])
                individual.sync_activation_levels()

    # evolves the current population to the next generation
    def evolve(self):
        # 1. Selection
        self.Select()
        # 2. Crossover
        self.Crossover()
        # 3. Mutation
        self.Mutation()
        
        # Reset parents and children
        self.parents = []
        self.children = []
        self.elite = []


# class representing the FCM algorithm
class Algorithm(object):

    def __init__(self, structure=None, activation_level=None, number_used=False, flt=None):
        flt = flt if flt is not None else FLT_class.define_al_fuzzy()

        iterations = 100  # number of iterations
        threshold = 0.001    # threshold

        # iterations, structure, activation_level, flt
        fcm_obj = FCM(iterations, structure, activation_level, flt, number_used=number_used)
        fcm_obj.run_fcm(threshold)
        self.fcm = fcm_obj
        self.result = fcm_obj.main_final_al


class ALGA_class():

    def __init__(self, n_runs, pop_size, generation, retain, target_val, structure, activation_level, flt, crossover_prob=0.7):
        if n_runs < 1 or generation < 1:
            raise ValueError("n_runs and generation must be positive")
        self.crossover_prob = crossover_prob
        self.n_runs = n_runs
        self.pop_size = pop_size
        self.generation = generation
        self.retain = retain
        self.target_val = flt.get_value(target_val) if isinstance(target_val, str) else target_val
        if isinstance(target_val, str) and target_val not in flt.linguistic_terms:
            raise ValueError(f"Unknown target term: {target_val}")
        if not 0 <= self.target_val <= 1:
            raise ValueError("Target must be between 0 and 1")
        self.structure = deepcopy(structure)
        self.activation_level = deepcopy(activation_level)
        self.flt = flt
        self.compute_individual_size()

    # compute the number of genes in the FCM
    def compute_individual_size(self):
        initial = Individual(structure=self.structure, activation_level=self.activation_level, flt=self.flt)
        self.individual_size = len(initial.genes)
        self.idx_to_remove = [item['id'] for item in self.activation_level
                              if item.get('enabled') is False]
        return self.individual_size

    # execute the what-if analysis of the FCM
    def what_if(self):
        results = []
        results_pop = []
        results_gen = []
        for k in range(self.n_runs):
            pop = Population(pop_size=self.pop_size, retain=self.retain, target_val=self.target_val, crossover_prob=self.crossover_prob, individual_size=self.individual_size, structure=self.structure, activation_level=self.activation_level, to_remove=self.idx_to_remove, flt=self.flt)

            for x in range(self.generation):
                pop.grade(generation=x)
                if pop.done or x == self.generation - 1: # if target value is reached or if we reached the last generation
                    print(f"\tSimulation: {k} Finished at generation: {x}, Population fitness: {pop.fitness_history[-1]}, Individual fitness: {pop.ind_fitness_history[-1]}")
                    break
                pop.evolve()

            finalAL = dict(pop.individuals[0].genes)   # copy of the activation levels of the best individual
            results.append(finalAL) # add the activation levels of the best individual to the results array
            results_pop.append(pop) # add the population to the results array
            results_gen.append(x)   # add the generation to the results array

        return results, results_pop, results_gen


    @staticmethod
    def visualize(results, results_pop, company_type):
        plt.figure(f"fitness_{company_type}")
        max_generations = max([len(pop.fitness_history) for pop in results_pop])
        for i in range(len(results)):
            pop_ = results_pop[i]
            # Plot fitness history
            plt.plot(np.arange(len(pop_.ind_fitness_history)), pop_.ind_fitness_history, label=f'Run: {i}')
        plt.ylabel('Fitness')
        plt.xlabel('Generations')
        plt.xticks(np.arange(0, max_generations, 2))
        plt.legend()
        plt.grid()
        plt.title("Fitness of the best individuals")
        plt.show(block=False)

        plt.figure("pop_fitness")
        max_generations = max([len(pop.fitness_history) for pop in results_pop])
        for i in range(len(results)):
            pop_ = results_pop[i]
            # Plot fitness history
            plt.plot(np.arange(len(pop_.fitness_history)), pop_.fitness_history, label=f'Run: {i}')
        plt.ylabel('Pop Fitness')
        plt.xlabel('Generations')
        plt.xticks(np.arange(0, max_generations, 2))
        plt.legend()
        plt.grid()
        plt.title("Fitness of the population")
        plt.show(block=False)

    @staticmethod
    def find_differences(initial, result):
        indices = [node_id for node_id in initial if initial[node_id] != result[node_id]]
        return indices, len(indices)

    def find_best_individual(self, results, results_pop):
        """Prefer runs reaching tolerance, then fewer changes and lower error."""
        initial = Individual(structure=self.structure, activation_level=self.activation_level, flt=self.flt)
        best = [pop.individuals[0] for pop in results_pop]
        if not best or len(results) != len(best):
            raise ValueError("Provide matching, nonempty results and populations")
        reached = [individual for individual in best if individual.fitness_val < 0.03]
        if reached:
            return min(reached, key=lambda individual: (
                self.find_differences(initial.genes, individual.genes)[1], individual.fitness_val))
        return min(best, key=lambda individual: individual.fitness_val)


if __name__ == "__main__":
    target_val = "VH"

    # genetic algorithm parameters
    n_runs = 2  # number of simulations
    pop_size = 50   # number of individuals (FCM) in the population
    generation = 250    # number of generations
    crossover_prob = 0.7    # probability of crossover
    retain = 15  # percentage of fittest individuals to be kept as parents for next generation (elitist selection)
    flt = FLT_class.define_al_fuzzy()

    structure = json.load(open(f'single_file.json'))
    activation_level = json.load(open(f'current_al.json'))
    target_val = flt.get_value(target_val)

    alga_obj = ALGA_class(n_runs, pop_size, generation, retain, target_val, structure, activation_level, flt, crossover_prob=crossover_prob)
    results, results_pop, results_gen = alga_obj.what_if()

    best = alga_obj.find_best_individual(results, results_pop)
    print(f"Best maturity: {best.algorithm.result:.5f}; fitness: {best.fitness_val}")
    # Numeric weights preserve the exact solution; labels and enabled flags are retained.
    with open('ga_activation_levels.json', 'w', encoding='utf-8') as output:
        json.dump(best.activation_level, output, indent=4)
