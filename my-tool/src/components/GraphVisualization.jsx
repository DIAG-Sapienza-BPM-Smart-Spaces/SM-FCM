import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { prepareGraphData} from '../utils/graphUtils';
import ElementsList from './ElementsList';

const GraphVisualization = ({ graphData }) => {
  const [shouldAnimate, setShouldAnimate] = useState(true); 
  const [selectedNode, setSelectedNode] = useState(null); 
  const [selectedZone, setSelectedZone] = useState(null); 
  const [generatedGraphData, setGeneratedGraphData] = useState(null); 
  const [filteredGraphData, setFilteredGraphData] = useState({ // Stato per i dati del grafo filtrato
    nodes: graphData.nodes || [],
    transitions: graphData.transitions || [],
  });
  const [enabledSections, setEnabledSections] = useState(   // Stato per le sezioni abilitate
    graphData.nodes.reduce((acc, node) => {
      if (node.role === 'root' || node.role === 'intermediate') {
        acc[node.id] = true; 
      }
      return acc;
    }, {})
  );
  const [isLoading, setIsLoading] = useState(false);  
  const [showGeneratedGraph, setShowGeneratedGraph] = useState(false);
  const [selectedGlobalWeight, setSelectedGlobalWeight] = useState('NA');
  const [generatedGraphMode, setGeneratedGraphMode] = useState(null); 
  const [colorVersion, setColorVersion] = useState(0);
  const generatedGraphRef = useRef(null);
  const [weightsDescription, setWeightsDescription] = useState({});
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  
  const [initialNodes, setInitialNodes] = useState(() =>  // Inizializza i nodi iniziali con i dati del grafo
  graphData.nodes.map(node => ({
    id: node.id,
    role: node.role,
    label: node.label || (node.meanings ? node.meanings.join(', ') : ''),
    weight: node.weight || 'NA',
    enabled: node.role === 'intermediate' ? true : undefined,
    meanings: node.meanings || [],
  }))
);

useEffect(() => { // Aggiorna la descrizione dei pesi quando i dati del grafo cambiano
  if (graphData.weights) setWeightsDescription(graphData.weights);
}, [graphData]);

useEffect(() => { // Inizializza i nodi iniziali quando il grafo cambia
  setInitialNodes(
    graphData.nodes.map(node => ({
      id: node.id,
      role: node.role,
      label: node.label || (node.meanings ? node.meanings.join(', ') : ''),
      weight: node.weight || 'NA',
      enabled: node.role === 'intermediate' ? true : undefined,
      meanings: node.meanings || [],
    }))
  );
}, [graphData]);

const nodeConnections = useMemo(() => { // Crea un oggetto che mappa gli ID dei nodi intermedi ai nodi connessi
  const connections = {};
  graphData.nodes.forEach(node => {
    if (node.role === 'intermediate') {
      const connected = graphData.nodes
        .filter(n => n.targets && n.targets.includes(node.id))
        .map(n => n.id);
      connections[node.id] = connected;
    }
  });
  return connections;
}, [graphData]);

  const getNodeAttributes = (weight) => { // Funzione per ottenere gli attributi dei nodi in base al peso
    switch (weight) {
      case 'VL':
        return { radius: 7.5, color: '#a3c1ad' }; // Verde chiaro
      case 'L':
        return { radius: 10, color: '#7fbf7f' }; // Verde medio
      case 'M':
        return { radius: 12.5, color: '#5fa55a' }; // Verde scuro
      case 'H':
        return { radius: 15, color: '#3f8f3f' }; // Verde più scuro
      case 'VH':
        return { radius: 17.5, color: '#2f6f2f' }; // Verde intenso
      default: 
        return { radius: 5, color: '#000' }; // Nero per "none"
    }
  };

  const getRedNodeAttributes = (weight) => { // Funzione per ottenere gli attributi dei nodi rossi
    switch (weight) {
      case 'VL':
        return { radius: 7.5, color: '#ffb3b3' }; // Rosso molto chiaro
      case 'L':
        return { radius: 10, color: '#ff6666' }; // Rosso chiaro
      case 'M':
        return { radius: 12.5, color: '#ff3333' }; // Rosso medio
      case 'H':
        return { radius: 15, color: '#e74c3c' }; // Rosso standard
      case 'VH':
        return { radius: 17.5, color: '#b71c1c' }; // Rosso intenso
      default:
        return { radius: 5, color: '#e74c3c' }; // Default rosso
    }
  };

  const weightLabels = useMemo(() => ({ // Mappa dei pesi per visualizzazione
    VL: 'Very Low',
    L: 'Low',
    M: 'Medium',
    H: 'High',
    VH: 'Very High',
    NA: 'Not Assigned',
    None: 'Not Assigned'
  }), []); // Mappa dei pesi

  const tableRef = useRef(null); 
  const svgRef = useRef(null);

  useEffect(() => {   //deseleziona nodo se click fuori tabella
    const handleClickOutside = (event) => {
      if (tableRef.current && !tableRef.current.contains(event.target)) {
        setSelectedNode(null); 
      }
    };
  
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {   //modifica altezza del svg sotto-grafo
    const tableElement = tableRef.current;
    const observer = new ResizeObserver(() => {
      if (tableElement && svgRef.current) {
        const tableHeight = Math.min(tableElement.offsetHeight, 320); 
        svgRef.current.style.height = `${tableHeight}px`;
      }
    });
  
    if (tableElement) {
      observer.observe(tableElement);
    }
  
    return () => {
      if (tableElement) {
        observer.unobserve(tableElement);
      }
    };
  }, [selectedZone, filteredGraphData]);

  useEffect(() => {   // Aggiorna i dati del grafo filtrato quando le sezioni abilitate cambiano
    const updateFilteredGraphData = () => {
      const enabledZoneIds = Object.keys(enabledSections).filter(zoneId => enabledSections[zoneId]);
  
      const visibleNodeIds = enabledZoneIds.flatMap(zoneId => nodeConnections[zoneId] || []);
  
      const rootNodeIds = graphData.nodes
        .filter(node => node.role === 'root')
        .map(node => node.id);
  
      const intermediateNodeIds = graphData.nodes
        .filter(node => node.role === 'intermediate' && enabledZoneIds.includes(node.id.toString()))
        .map(node => node.id);
  
      const allVisibleNodeIds = [...new Set([...visibleNodeIds, ...rootNodeIds, ...intermediateNodeIds])];
  
      const filteredNodes = graphData.nodes
        .map(node => ({
          ...node,
          weight: initialNodes.find(n => n.id === node.id)?.weight || node.weight,
        }))
        .filter(node => allVisibleNodeIds.includes(node.id));

      const filteredTransitions = graphData.transitions.filter(
        link => allVisibleNodeIds.includes(link.from) && allVisibleNodeIds.includes(link.to)
      );
  
      setFilteredGraphData({
        nodes: filteredNodes,
        transitions: filteredTransitions,
      });
    };
  
    updateFilteredGraphData();
  }, [enabledSections, graphData, nodeConnections, initialNodes]);

  useEffect(() => {         //SUB-GRAPH
    if (!selectedZone || !enabledSections[selectedZone.id]) return;
  
    const connectedNodeIds = nodeConnections[selectedZone.id] || [];
    const connectedNodes = graphData.nodes.filter(node => connectedNodeIds.includes(node.id));
  
    const connectedLinks = graphData.transitions
      .filter(link => connectedNodeIds.includes(link.from) && connectedNodeIds.includes(link.to))
      .map(link => ({
        ...link,
        source: connectedNodes.find(node => node.id === link.from),
        target: connectedNodes.find(node => node.id === link.to),
      }));
  
    const container = d3.select('#subgraph');
    container.selectAll('*').remove();
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
  
    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height);
  
    const graphGroup = svg.append('g');
  
    const simulation = d3.forceSimulation(connectedNodes)
      .force('link', d3.forceLink(connectedLinks).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    const zoom = d3.zoom()
      .scaleExtent([0.5, 2]) 
      .on('zoom', (event) => {
        graphGroup.attr('transform', event.transform); 
      });

    svg.call(zoom); 
    
    const link = graphGroup.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(connectedLinks)
      .enter()
      .append('line')
      .attr('stroke-width', d => d.weight * 2) 
      .attr('stroke', '#aaa');
  
    const node = graphGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(connectedNodes)
      .enter()
      .append('circle')
      .attr('r', d => getNodeAttributes(d.weight).radius) 
      .attr('fill', d => getNodeAttributes(d.weight).color) 
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style("cursor", "pointer")
      .on('click', (event, d) => {
        setSelectedNode(d); 
        event.stopPropagation(); 
      })
      .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = d.x;
        d.fy = d.y;
      }));
  
    const labels = graphGroup.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(connectedNodes)
      .enter()
      .append('text')
      .attr('font-size', d => `${Math.max(10, d.weight * 2)}px`)
      .attr('fill', '#333')
      .text(d => d.meanings.join(', '));
  
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
  
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
  
      labels
        .attr('x', d => d.x + 12)
        .attr('y', d => d.y + 3);
    });

    simulation.alpha(1).restart();
    
  }, [enabledSections, filteredGraphData, selectedZone, graphData, nodeConnections, selectedNode]); 

  const renderMainGraph = useCallback(() => {     //MAIN GRAPH  
    if (!filteredGraphData || !filteredGraphData.nodes || !filteredGraphData.transitions) {
      console.error('Graph\'s values not valid:', filteredGraphData);
      return;
    } 

    const { nodeData, edgeData } = prepareGraphData(filteredGraphData.nodes, filteredGraphData.transitions);

    const container = d3.select('#graph');
    container.selectAll('*').remove();

    const width = container.node().clientWidth; 
    const height = width * 0.5; 

    const svg = container
      .append('svg')
      .style('background-color', '#f9f9f9')
      .attr('width', '100%') 
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`) 
      .attr('preserveAspectRatio', 'xMidYMid meet') 
      .style('border', '1px solid #ccc');

    const graphGroup = svg.append('g'); 

    const zoom = d3.zoom()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        graphGroup.attr('transform', event.transform); 
      });

    svg.call(zoom); 

    const simulation = d3.forceSimulation(nodeData)
      .force("link", d3.forceLink(edgeData).id(d => d.id).distance(250))
      .force("charge", d3.forceManyBody().strength(-1200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("radial", d3.forceRadial(
        d => {
          if (d.role === "root") return 0;
          if (d.role === "intermediate") return 350; 
          return 500; 
        },
        width / 2,
        height / 2
      ).strength(0.9))
      .force("collision", d3.forceCollide().radius(d => getNodeAttributes(d.weight).radius + 5).iterations(5));

    simulation.on('end', () => {
      nodeData.forEach(d => {
        d.fx = d.x; 
        d.fy = d.y;
      });
      simulation.stop();
    });

    const link = graphGroup.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edgeData)
      .enter()
      .append('line')
      .attr('stroke-width', d => Math.sqrt(d.weight) * 5)
      .attr('stroke', '#7dafff')
      .attr("stroke-opacity", 0.6)

    const node = graphGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodeData)
      .enter()
      .append('circle')
      .attr('r', d => getNodeAttributes(d.weight).radius) 
      .attr('fill', d => getNodeAttributes(d.weight).color) 
      .style("cursor", "default") 
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = d.x;
          d.fy = d.y;
        }));


    const labels = graphGroup.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodeData)
      .enter()
      .append('text')
      .attr('font-size', '20px')
      .attr('fill', '#333')
      .text(d => d.meanings.join(', '));

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x + 12)
        .attr('y', d => d.y + 3);
    });

    if (shouldAnimate) {
      simulation.alpha(1).restart();
      setShouldAnimate(false);
    }
    
  }, [filteredGraphData, shouldAnimate]);

  const zones = graphData.nodes.filter( // Filtra i nodi per ottenere solo le zone
    node =>
      (node.role === 'root' || node.role === 'intermediate') &&
      !node.meanings.includes('Smart Manufacturing')
  );

  useEffect(() => {       // Effettua il rendering del grafo principale quando i dati cambiano
    renderMainGraph();
  }, [renderMainGraph]);

  const handleZoneClick = (zone) => {  // Gestisce il click su una zona per mostrare i nodi connessi
    if (selectedZone?.id === zone.id) {
      setSelectedZone(null);
      setSelectedNode(null); 
    } else {
      setSelectedZone(zone);
      setSelectedNode(null); 
  
      const connectedNodeIds = nodeConnections[zone.id] || [];
      const connectedNodes = graphData.nodes.filter(node => connectedNodeIds.includes(node.id));
      connectedNodes.forEach(node => {
        node.fx = null;
        node.fy = null;
      });

      //setFilteredGraphData((prev) => ({ ...prev })); 
    }
  };

  const handleUpdateWeight = (nodeId, newWeight) => {   // Aggiorna il peso del nodo selezionato
    if (selectedNode && selectedNode.role === 'final') {
      const nodeIndex = initialNodes.findIndex(node => node.id === nodeId);
      if (nodeIndex !== -1) {        

        const updatedInitialNodes = [...initialNodes];
        updatedInitialNodes[nodeIndex] = {
          ...updatedInitialNodes[nodeIndex],
          weight: newWeight,
        };
        setInitialNodes(updatedInitialNodes);

        const updatedNodes = graphData.nodes.map(node =>
          node.id === nodeId ? { ...node, weight: newWeight } : node
        );

        const updatedFilteredNodes = filteredGraphData.nodes.map(node =>
          node.id === nodeId ? { ...node, weight: newWeight } : node
        );
        
        graphData.nodes = updatedNodes;
        setFilteredGraphData(prev => ({
          ...prev,
          nodes: updatedFilteredNodes,
        }));
        setSelectedNode(prevNode =>
          prevNode?.id === nodeId ? { ...prevNode, weight: newWeight } : prevNode
        );
      
        console.log('Aggiornamento in corso per il nodo:', nodeId, 'con peso:', newWeight);
      }

      //alert(`Node ${selectedNode.meanings?.join(', ')} weight updated to ${newWeight}`);
    }
  };

  const handleExecutePython = async () => {   // Esegue il codice Python per l'inferenza
    if (!filteredGraphData || !filteredGraphData.nodes) {
      console.error('Filtered graph data is not valid:', filteredGraphData);
      alert('Graph data is not properly loaded. Please try again.');
      return;
    }
  
    const enabledZoneIds = Object.keys(enabledSections).filter(zoneId => enabledSections[zoneId]);
    const visibleNodeIds = enabledZoneIds.flatMap(zoneId => nodeConnections[zoneId] || []);
    const invalidNodes = filteredGraphData.nodes.filter(
      node => visibleNodeIds.includes(node.id) && (!node.weight || node.weight === 'None' || node.weight === 'NA')
    );
  
    if (invalidNodes.length > 0) {
      const errorMessage = invalidNodes.map(node => {
        const intermediateNode = graphData.nodes.find(intermediate =>
          intermediate.role === 'intermediate' &&
          nodeConnections[intermediate.id]?.includes(node.id)
        );
      
        const sectionName = intermediateNode?.meanings?.join(', ') || 'Unknown Section';
        const nodeMeanings = node.meanings?.join(', ') || 'No Meanings';
        return `Node ID: ${node.id}, Node Name: ${nodeMeanings}, Section: ${sectionName}`;
      }).join('\n');
  
      alert(`The following nodes have invalid weights:\n\n${errorMessage}`);
      return;
    }

    const structure = {
      nodes: graphData.nodes,
      transitions: graphData.transitions,
    };
    
    const outputNodes = initialNodes.map(node => ({ ...node }));

    outputNodes.forEach(node => {
      if (node.role === 'intermediate') {
        node.enabled = !!enabledSections[node.id];
      }
    });

    const activation_level = outputNodes;
  
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ structure, activation_level }),
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('Dati restituiti dal backend:', result.graphData); 
        alert(result.message);
  
        const enabledIntermediateIds = outputNodes
          .filter(n => n.role === 'intermediate' && n.enabled)
          .map(n => n.id);

        const visibleNodeIds = [
          ...graphData.nodes.filter(n => n.role === 'root').map(n => n.id),
          ...enabledIntermediateIds,
          ...enabledIntermediateIds.flatMap(id => nodeConnections[id] || [])
        ];

        const filteredNodes = result.graphData.nodes.filter(n => visibleNodeIds.includes(n.id));
        const filteredTransitions = result.graphData.transitions.filter(
          t => visibleNodeIds.includes(t.from) && visibleNodeIds.includes(t.to)
        );

        setShowGeneratedGraph(true);
        setGeneratedGraphMode('inference');
        setGeneratedGraphData({
          nodes: filteredNodes,
          transitions: filteredTransitions,
        });

        setTimeout(() => {
          generatedGraphRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        const error = await response.json();
        console.error('Errore dal backend:', error);
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Errore durante la richiesta:', error);
      alert('An error occurred while executing the Python script.');
    } finally {
      setIsLoading(false);
    }
  };

  const initialNodeMap = useMemo( // Crea una mappa dei nodi iniziali per un accesso rapido
    () => Object.fromEntries(initialNodes.map(n => [n.id, n.weight])),
    [initialNodes]
  );
  
  const renderGeneratedGraph = useCallback((graphData) => { // Renderizza il grafo generato
    if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.transitions)) {
      console.error('Invalid graph data:', graphData);
      alert('The graph data is invalid. Please check the backend.');
      return;
    }

    const { nodeData, edgeData } = prepareGraphData(graphData.nodes, graphData.transitions);

    nodeData.forEach(node => {
      node.x = undefined;
      node.y = undefined;
      node.vx = undefined;
      node.vy = undefined;
      node.fx = undefined;
      node.fy = undefined;
    });

    const container = d3.select('#generated-graph');
    container.selectAll('*').remove();

    if (container.empty()) {
      console.error('Generated graph container not found');
      return;
    }

    const width = container.node().clientWidth;
    const height = 500;

    const svg = container
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('background-color', '#f9f9f9')
      .style('border', '1px solid #ccc')
      .style('border-radius', '8px');

    const graphGroup = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        graphGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Tooltip per mostrare informazioni dettagliate
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', '#fff')
      .style('border', '1px solid #ccc')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('box-shadow', '0px 4px 6px rgba(0, 0, 0, 0.1)')
      .style('pointer-events', 'none')
      .style('display', 'none');

    const simulation = d3.forceSimulation(nodeData)
      .force("link", d3.forceLink(edgeData).id(d => d.id).distance(250))
      .force("charge", d3.forceManyBody().strength(-1200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("radial", d3.forceRadial(
        d => {
          if (d.role === "root") return 0;
          if (d.role === "intermediate") return 350;
          return 500;
        },
        width / 2,
        height / 2
      ).strength(0.9))
      .force("collision", d3.forceCollide().radius(d => getNodeAttributes(d.weight).radius + 5).iterations(5));

    simulation.on('end', () => {
      graphData.nodes.forEach(d => {
        d.fx = d.x;
        d.fy = d.y;
      });
      simulation.stop();
    });

    const link = graphGroup.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edgeData)
      .enter()
      .append('line')
      .attr('stroke-width', d => d.weight * 2 || 1)
      .attr('stroke', '#aaa');

    const labels = graphGroup.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodeData)
      .enter()
      .append('text')
      .attr('font-size', '24px')
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', -15)
      .text(d => d.label || d.meanings.join(', '));

    const nodeGroup = graphGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodeData)
      .enter()
      .append('g');

    const weightOrder = { VL: 0, L: 1, M: 2, H: 3, VH: 4 };

    function compareWeights(initial, current) {
      if (!(initial in weightOrder) || !(current in weightOrder)) return 0;
      if (weightOrder[current] > weightOrder[initial]) return 1; // aumentato
      if (weightOrder[current] < weightOrder[initial]) return -1; // diminuito
      return 0; // uguale
    }

    // 1. Cerchio base per tutti i nodi (sempre visibile)
        
    nodeGroup.each(function(d) {
      const initial = initialNodeMap[d.id];
      const current = d.weight;
      const isRootOrIntermediate = d.role === 'root' || d.role === 'intermediate';
      const cmp = initial ? compareWeights(initial, current) : 0;

      // Peso aumentato: rosso dietro, verde sopra
      if (cmp === 1) {
        // Cerchio rosso dietro (peso attuale)
        d3.select(this).append('circle')
          .attr('r', getRedNodeAttributes(current).radius)
          .attr('fill', getRedNodeAttributes(current).color)
          .attr('stroke', getRedNodeAttributes(current).color)
          .attr('stroke-width', 2)
          .attr('opacity', 1);

        // Cerchio verde sopra (peso iniziale)
        d3.select(this).append('circle')
          .attr('r', getNodeAttributes(initial).radius)
          .attr('fill', isRootOrIntermediate ? getRedNodeAttributes(initial).color : getNodeAttributes(initial).color)
          .attr('stroke', isRootOrIntermediate ? getRedNodeAttributes(initial).color : getNodeAttributes(initial).color)
          .attr('stroke-width', 2)
          .attr('opacity', 1);
      }
      // Peso diminuito: verde dietro, rosso sopra
      else if (cmp === -1) {
        // Cerchio verde dietro (peso iniziale)
        d3.select(this).append('circle')
          .attr('r', getNodeAttributes(initial).radius)
          .attr('fill', isRootOrIntermediate ? getRedNodeAttributes(initial).color : getNodeAttributes(initial).color)
          .attr('stroke', isRootOrIntermediate ? getRedNodeAttributes(initial).color : getNodeAttributes(initial).color)
          .attr('stroke-width', 2)
          .attr('opacity', 1);

        // Cerchio rosso sopra (peso attuale)
        d3.select(this).append('circle')
          .attr('r', getNodeAttributes(current).radius)
          .attr('fill', getRedNodeAttributes(current).color)
          .attr('stroke', getRedNodeAttributes(current).color)
          .attr('stroke-width', 2)
          .attr('opacity', 1);
      }
      // Peso invariato: solo verde
      else {
        d3.select(this).append('circle')
          .attr('r', getNodeAttributes(current).radius)
          .attr('fill', isRootOrIntermediate ? getRedNodeAttributes(current).color : getNodeAttributes(current).color)
          .attr('stroke', isRootOrIntermediate ? getRedNodeAttributes(current).color : '#27ae60')
          .attr('stroke-width', 2)
          .attr('opacity', 1);
      }
    });

    nodeGroup.selectAll('circle')
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        const initialWeight = initialNodeMap[d.id];
        const currentWeight = d.weight;
        const initialLabel = weightLabels[initialWeight] || initialWeight;
        const currentLabel = weightLabels[currentWeight] || currentWeight || 'N/A';
        let html = '';
        if (
          generatedGraphMode === 'inference' &&
          d.role === 'final' &&
          initialWeight 
        ) {
          html += `<strong>Initial Weight:</strong> ${initialLabel}<br>`;
          html += `<strong>Current Weight:</strong> ${currentLabel}<br>`;
        } else {
          html += `<strong>Current Weight:</strong> ${currentLabel}<br>`;
        }
        html += `<strong>Current Numeric Weight:</strong> ${d.numeric_weight || 'N/A'}`;
        tooltip
          .style('display', 'block')
          .html(html);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', `${event.pageY + 10}px`)
          .style('left', `${event.pageX + 10}px`);
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = d.x;
          d.fy = d.y;
        }));

    // Nel tick aggiorna tutti i cerchi
    nodeGroup.selectAll('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeGroup.selectAll('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y - 10);
    });

  }, [weightLabels, initialNodeMap, generatedGraphMode]);

  const handleExecutePythonSimulation = async () => { // Esegue il codice Python per la simulazione
    if (!filteredGraphData || !filteredGraphData.nodes) {
      alert('Graph data is not properly loaded. Please try again.');
      return;
    }

    const enabledZoneIds = Object.keys(enabledSections).filter(zoneId => enabledSections[zoneId]);
    const visibleNodeIds = enabledZoneIds.flatMap(zoneId => nodeConnections[zoneId] || []);
    const invalidNodes = filteredGraphData.nodes.filter(
      node => visibleNodeIds.includes(node.id) && (!node.weight || node.weight === 'None' || node.weight === 'NA')
    );

    if (invalidNodes.length > 0) {
      const errorMessage = invalidNodes.map(node => {
        const intermediateNode = graphData.nodes.find(intermediate =>
          intermediate.role === 'intermediate' &&
          nodeConnections[intermediate.id]?.includes(node.id)
        );
        const sectionName = intermediateNode?.meanings?.join(', ') || 'Unknown Section';
        const nodeMeanings = node.meanings?.join(', ') || 'No Meanings';
        return `Node ID: ${node.id}, Node Name: ${nodeMeanings}, Section: ${sectionName}`;
      }).join('\n');

      alert(`The following nodes have invalid weights:\n\n${errorMessage}`);
      return;
    }

    const structure = {
      nodes: graphData.nodes,
      transitions: graphData.transitions,
    };
    
    const outputNodes = initialNodes.map(node => ({ ...node }));

    outputNodes.forEach(node => {
      if (node.role === 'intermediate') {
        node.enabled = !!enabledSections[node.id];
      }
    });

    const activation_level = outputNodes;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ structure, activation_level, global_weight: selectedGlobalWeight }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);

        const enabledIntermediateIds = outputNodes
          .filter(n => n.role === 'intermediate' && n.enabled)
          .map(n => n.id);

        const visibleNodeIds = [
          ...graphData.nodes.filter(n => n.role === 'root').map(n => n.id),
          ...enabledIntermediateIds,
          ...enabledIntermediateIds.flatMap(id => nodeConnections[id] || [])
        ];

        const filteredGraphData = result.graphData.map(graph => ({
          nodes: graph.nodes.filter(n => visibleNodeIds.includes(n.id)),
          transitions: graph.transitions.filter(
            t => visibleNodeIds.includes(t.from) && visibleNodeIds.includes(t.to)
          ),
        }));

        setColorVersion(1);
        setShowGeneratedGraph(true);
        setGeneratedGraphMode('simulation');
        setGeneratedGraphData(filteredGraphData);
        
        setTimeout(() => {
          generatedGraphRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('An error occurred while executing the Python script.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {   // Effettua il rendering del grafo generato quando i dati cambiano
    if (!showGeneratedGraph || !generatedGraphData) return;

    if (generatedGraphMode === 'simulation') {
      const graphIndex = colorVersion - 1;
      if (
        Array.isArray(generatedGraphData) &&
        generatedGraphData[graphIndex] &&
        Array.isArray(generatedGraphData[graphIndex].nodes) &&
        Array.isArray(generatedGraphData[graphIndex].transitions)
      ) {
        renderGeneratedGraph(generatedGraphData[graphIndex]);
      }
    } else if (
      generatedGraphData &&
      Array.isArray(generatedGraphData.nodes) &&
      Array.isArray(generatedGraphData.transitions)
    ) {
      renderGeneratedGraph(generatedGraphData);
    }
  }, [showGeneratedGraph, generatedGraphData, renderGeneratedGraph, colorVersion, generatedGraphMode]);

  useEffect(() => {   // Aggiorna lo stato dei nodi iniziali in base alle sezioni abilitate
    setInitialNodes(prev =>
      prev.map(node =>
        node.role === 'intermediate'
          ? { ...node, enabled: !!enabledSections[node.id] }
          : node
      )
    );
  }, [enabledSections]);

  return (
    <div className="box-container">
      <div>
        {/* Pulsante info fisso */}
        <button
          onClick={() => setShowInfoSidebar(true)}
          className="fixed top-4 left-4 z-50 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-blue-700 transition"
          title="Show info"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          <span style={{ fontSize: 22, fontWeight: 'bold' }}>i</span>
        </button>

        {/* Sidebar info */}
        {showInfoSidebar && (
        <>
          {/* Overlay trasparente che chiude la sidebar se cliccato */}
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-10"
            onClick={() => setShowInfoSidebar(false)}
          />
          {/* Sidebar info */}
          <div
            className="fixed top-0 left-0 h-full w-80 max-w-full bg-white shadow-2xl z-50 flex flex-col p-6 border-r border-gray-200 animate-slide-in overflow-y-auto max-h-screen"
            onClick={e => e.stopPropagation()} // Previene la chiusura se clicchi dentro la sidebar
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-700">How to use the FCM-based Maturity Model</h2>
              <button
                onClick={() => setShowInfoSidebar(false)}
                className="text-gray-500 hover:text-blue-700 text-2xl font-bold"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="text-gray-700 text-base leading-relaxed">
              {/* Sostituisci questo testo con quello definitivo */}
              <p>
                This tool allows you to explore and simulate the maturity level of Smart Manufacturing technologies using a Fuzzy Cognitive Map (FCM) model.<br /><br />
                <strong>How it works:</strong><br />
                - Select sections to enable or disable parts of the model.<br />
                - Assign weights to nodes to represent the current state.<br />
                - Run inference or simulation to see the impact on the system.<br /><br />
                For more details, refer to the documentation or contact support.
              </p>
              <div className="mt-6 max-w-2xl mx-auto bg-blue-50 rounded-lg p-4 shadow">
                <h3 className="font-bold mb-2 text-blue-700 flex items-center gap-2">
                  <span role="img" aria-label="info">ℹ️</span> Weight Levels Meaning
                </h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {Object.entries(weightsDescription).map(([key, desc]) => (
                    <li key={key}>
                      <span className="font-semibold">{key}:</span> {desc}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
        )}
      </div>
      <div id="graph" style={{ width: '100%', height: '400px', border: '1px solid #ccc' }}></div>

      {/* Zona pulsanti */}
      <div className="mt-4 bg-white p-4 rounded shadow-md">
        <h3 className="text-lg font-bold mb-2">Select Section</h3>
        <div className=" zone-buttons flex flex-wrap gap-20">
          {zones.map(zone => (
            <button
              key={zone.id}
              onClick={() => handleZoneClick(zone)}
              className={`px-4 py-2 rounded ${
                selectedZone?.id === zone.id ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {zone.meanings.join(', ')}
            </button>
          ))}
        </div>
      </div>

      {/* Zona tabellare */}
      {selectedZone && (
        <div className="table-svg-container mt-4 bg-white p-4 rounded shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold mb-2">
              Node Connected to {selectedZone.meanings.join(', ')}
            </h3>
            <label className="flex items-center gap-2">
              <span className="text-sm font-bold">Enable Section</span>
              <input
                type="checkbox"
                checked={enabledSections[selectedZone.id]}
                onChange={() => {
                  const newEnabled = !enabledSections[selectedZone.id];
                  
                  const enabledCount = Object.entries(enabledSections)
                    .filter(([id, enabled]) => {
                      const node = initialNodes.find(n => n.id === Number(id));
                      return node?.role === 'intermediate' && enabled;
                    }).length;

                  if (!newEnabled && enabledCount === 1) {
                    alert('At least one section must remain enabled.');
                    return;
                  }
                  
                  setEnabledSections(prev => ({
                    ...prev,
                    [selectedZone.id]: newEnabled,
                  }));
                  setSelectedNode(null);
                  setShouldAnimate(false);

                  setInitialNodes(prev =>
                    prev.map(node =>
                      node.id === selectedZone.id && node.role === 'intermediate'
                        ? { ...node, enabled: newEnabled }
                        : node
                    )
                  );
                }}
                className="toggle-checkbox"
              />
            </label>
          </div>
          {enabledSections[selectedZone.id] ? (
            <div className="flex">
              {/* Colonna sinistra: Tabella */}
              <div className="table-column flex-1" ref={tableRef}>
                <ElementsList
                  nodes={graphData.nodes}
                  connectedNodeIds={nodeConnections[selectedZone.id] || []}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                  onUpdateWeight={handleUpdateWeight}
                />
              </div>

              {/* Colonna destra: SVG */}
              <div className="svg-column flex-1">
                <div id="subgraph" className="w-full h-full border rounded" ref={svgRef}></div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center mt-4">
              This section is disabled. Enable it to view the table and subgraph.
            </div>
          )}
        </div>
      )}

      {/* Zona per eseguire il codice Python */}
      <div className="mt-4 bg-gray-50 p-6 rounded-xl shadow flex flex-col md:flex-row gap-8 border border-gray-200">
        {/* Sinistra: Esecuzione standard */}
        <div className="flex-1 flex flex-col items-center justify-center md:pr-8 md:border-r border-gray-200">
          <h3 className="text-xl font-bold mb-2 text-blue-700 text-center">Execute Interference Script</h3>
          <p className="text-sm text-gray-600 mb-6 text-center">
            Click the button below to execute the Python script associated with the graph.
          </p>
          <button
            onClick={handleExecutePython}
            className={`w-48 bg-blue-500 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-600 transition-all duration-150 text-lg font-semibold ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              'Run Inference'
            )}
          </button>
        </div>

        {/* Destra: Esecuzione con peso globale */}
        <div className="flex-1 flex flex-col items-center justify-center md:pl-8">
          <h3 className="text-xl font-bold mb-2 text-green-700 text-center">Execute Simulation Script</h3>
          <p className="text-sm text-gray-600 mb-6 text-center">
            Select a weight for <span className="font-semibold text-green-700">Smart Manufacturing</span> to achieve and execute the Simulation Script.
          </p>
          <select
            value={selectedGlobalWeight}
            onChange={e => setSelectedGlobalWeight(e.target.value)}
            className="w-48 p-3 border border-gray-300 rounded-lg mb-6 text-base focus:outline-none focus:ring-2 focus:ring-green-400 transition"
          >
            <option value="NA" disabled>Select Weight</option>
            <option value="VL">Very Low</option>
            <option value="L">Low</option>
            <option value="M">Medium</option>
            <option value="H">High</option>
            <option value="VH">Very High</option>
          </select>
          <button
            onClick={handleExecutePythonSimulation}
            className={`w-48 bg-green-500 text-white px-6 py-3 rounded-lg shadow hover:bg-green-600 transition-all duration-150 text-lg font-semibold ${isLoading || selectedGlobalWeight === 'NA' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading || selectedGlobalWeight === 'NA'}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              'Run Simulation'
            )}
          </button>
        </div>
      </div>
      {showGeneratedGraph && (
        <div 
          id="generated-graph-container" 
          className="mt-8 bg-white p-6 rounded-2xl shadow-lg border border-gray-200"
          ref={generatedGraphRef}
        >
          <h3 className="text-lg font-bold mb-4 text-center">Generated Graph</h3>
          {generatedGraphMode === 'inference' && (
            <div className="flex justify-center">
              <div className="relative">
              </div>
            </div>
          )}
          {/* Mostra i pulsanti SOLO in modalità simulazione */}
          {generatedGraphMode === 'simulation' && (
          <div className="flex justify-center gap-4 mb-4">
            {[1, 2].map(v => (
              <button
                key={v}
                className={`px-4 py-2 rounded-lg shadow transition-all duration-150 border 
                  ${colorVersion === v
                    ? 'bg-gradient-to-r from-green-400 to-blue-500 text-white border-blue-500 scale-105'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-100 hover:text-blue-700'}`}
                onClick={() => setColorVersion(v)}
              >
                <span className="font-semibold">Alternative {v}</span>
              </button>
            ))}
          </div>
          )}
          <div id="generated-graph" className="w-full h-auto"></div>
          {/* Legenda dettagliata per i pesi */}
          <div className="flex flex-col items-center mt-4">
            <span className="font-semibold mb-2">Legend: Weight Levels</span>
            <div className="overflow-x-auto w-full max-w-2xl">
              <table className="border-collapse rounded-xl shadow bg-white w-full">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-4 py-2 border text-center rounded-tl-xl">Weight</th>
                    <th className="px-4 py-2 border text-center">Initial State</th>
                    <th className="px-4 py-2 border text-center">Current State</th>
                    <th className="px-4 py-2 border text-center rounded-tr-xl">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {['VL', 'L', 'M', 'H', 'VH'].map((w, i) => (
                    <tr key={w} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-2 border text-center font-semibold">{weightLabels[w]}</td>
                      <td className="px-4 py-2 border text-center">
                        <span
                          className="inline-block w-6 h-6 rounded-full border shadow"
                          style={{
                            background: getNodeAttributes(w).color,
                            borderColor: getNodeAttributes(w).color,
                          }}
                          title={`Green: ${weightLabels[w]}`}
                        ></span>
                      </td>
                      <td className="px-4 py-2 border text-center">
                        <span
                          className="inline-block w-6 h-6 rounded-full border shadow"
                          style={{
                            background: getRedNodeAttributes(w).color,
                            borderColor: getRedNodeAttributes(w).color,
                          }}
                          title={`Red: ${weightLabels[w]}`}
                        ></span>
                      </td>
                      <td className="px-4 py-2 border text-left text-xs">{weightsDescription[weightLabels[w]] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphVisualization;