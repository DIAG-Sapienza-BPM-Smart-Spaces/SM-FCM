// Dati di esempio per inizializzare il grafo
/*export let initialNodes = [
  { id: 0, role: 'root', label: 'Smart Manufactoring', weight: 'NA' },
  { id: 1, role: 'intermediate', label: 'CAD, CAM, PLM', weight: 'NA', enabled: true },
  { id: 2, role: 'intermediate', label: 'CRM', weight: 'NA', enabled: true },
  { id: 3, role: 'intermediate', label: 'ERP, SCM', weight: 'NA', enabled: true },
  { id: 4, role: 'intermediate', label: 'WMS, TMS', weight: 'NA', enabled: true },
  { id: 5, role: 'intermediate', label: 'MES', weight: 'NA', enabled: true },
  { id: 6, role: 'leaf', label: 'IIoT', weight: 'NA' },
  { id: 7, role: 'leaf', label: 'Cloud Services', weight: 'NA' },
  { id: 8, role: 'leaf', label: 'AI, CV, PM, RPA', weight: 'NA' },
  { id: 9, role: 'leaf', label: 'Cyber Security', weight: 'NA' },
  { id: 10, role: 'leaf', label: 'AR, VR', weight: 'NA' },
  { id: 11, role: 'leaf', label: 'Digital Twin', weight: 'NA' },
  { id: 12, role: 'leaf', label: 'DM, BI', weight: 'NA' },
  { id: 13, role: 'leaf', label: 'IIoT', weight: 'NA' },
  { id: 14, role: 'leaf', label: 'Cloud Services', weight: 'NA' },
  { id: 15, role: 'leaf', label: 'AI, CV, PM, RPA', weight: 'NA' },
  { id: 16, role: 'leaf', label: 'Cyber Security', weight: 'NA' },
  { id: 17, role: 'leaf', label: 'AR, VR', weight: 'NA' },
  { id: 18, role: 'leaf', label: 'DM, BI', weight: 'NA' },
  { id: 19, role: 'leaf', label: 'IIoT', weight: 'NA' },
  { id: 20, role: 'leaf', label: 'Cloud Services', weight: 'NA' },
  { id: 21, role: 'leaf', label: 'AI, CV, PM, RPA', weight: 'NA' },
  { id: 22, role: 'leaf', label: 'Cyber Security', weight: 'NA' },
  { id: 23, role: 'leaf', label: 'Robotics', weight: 'NA' },
  { id: 24, role: 'leaf', label: 'AR, VR', weight: 'NA' },
  { id: 25, role: 'leaf', label: 'Digital Twin', weight: 'NA' },
  { id: 26, role: 'leaf', label: 'DM, BI', weight: 'NA' },
  { id: 27, role: 'leaf', label: 'IIoT', weight: 'NA' },
  { id: 28, role: 'leaf', label: 'Cloud Services', weight: 'NA' },
  { id: 29, role: 'leaf', label: 'AI, CV, PM, RPA', weight: 'NA' },
  { id: 30, role: 'leaf', label: 'Cyber Security', weight: 'NA' },
  { id: 31, role: 'leaf', label: 'Robotics', weight: 'NA' },
  { id: 32, role: 'leaf', label: 'AR, VR', weight: 'NA' },
  { id: 33, role: 'leaf', label: 'Digital Twin', weight: 'NA' },
  { id: 34, role: 'leaf', label: 'DM, BI', weight: 'NA' },
  { id: 35, role: 'leaf', label: 'IIoT', weight: 'NA' },
  { id: 36, role: 'leaf', label: 'Cloud Services', weight: 'NA' },
  { id: 37, role: 'leaf', label: 'AI, CV, PM, RPA', weight: 'NA' },
  { id: 38, role: 'leaf', label: 'Cyber Security', weight: 'NA' },
  { id: 39, role: 'leaf', label: 'Robotics', weight: 'NA' },
  { id: 40, role: 'leaf', label: 'AR, VR', weight: 'NA' },
  { id: 41, role: 'leaf', label: 'Digital Twin', weight: 'NA' },
  { id: 42, role: 'leaf', label: 'DM, BI', weight: 'NA' },
];*/

export const prepareGraphData = (nodes, transitions, weights = []) => {
  const nodeData = nodes.map(n => {
    // Cerca il peso aggiornato per questo nodo
    const found = weights.find(w => w.id === n.id);
    return {
      ...n,
      weight: found ? found.weight : n.weight,
    };
  });

  const rootEdges = nodes
    .filter(n => n.role === 'intermediate')
    .map(n => ({
      source: 0, 
      target: n.id,
      weight: 1, 
    }));

  const intermediateEdges = nodes
    .filter(n => n.role === 'intermediate')
    .flatMap(intermediateNode =>
      nodes
        .filter(finalNode => finalNode.targets && finalNode.targets.includes(intermediateNode.id))
        .map(finalNode => ({
          source: intermediateNode.id,
          target: finalNode.id,
          weight: 1, 
        }))
    );

  const edgeData = [
    ...transitions.map(t => ({
      source: t.from,
      target: t.to,
      weight: t.weight,
    })),
    ...rootEdges,
    ...intermediateEdges,
  ];

  return { nodeData, edgeData };
};

export const updateNodeWeight = (nodes, nodeId, weight) => {
  return nodes.map(node =>
    node.id === nodeId ? { ...node, weight } : node
  );
};

export const getNodeById = (nodes, id) => {
  return nodes.find(node => node.id === id);
};

export const getEdgeDescription = (nodes, edge) => {
  const sourceNode = getNodeById(nodes, edge.source);
  const targetNode = getNodeById(nodes, edge.target);
  return `${sourceNode?.meanings?.join(', ') || 'Node'} → ${targetNode?.meanings?.join(', ') || 'Node'}`;
};
  