import React, { useState, useEffect } from 'react';
import Graph from './components/GraphVisualization';

function App() {
  // Stato iniziale per il grafo
  const [graphData, setGraphData] = useState({
    nodes: [],
    transitions: [],
  });

  useEffect(() => {
    const fileInput = document.getElementById('fileInput');

    const handleFileChange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            // Verifica che il file abbia il formato corretto
            if (data.nodes && data.transitions) {
              setGraphData(data);
            } else {
              alert('Il file JSON deve contenere "nodes" e "transitions".');
            }
          } catch (error) {
            alert('Errore nel parsing del file JSON.');
          }
        };
        reader.readAsText(file);
      }
    };

    fileInput.addEventListener('change', handleFileChange);

    return () => {
      fileInput.removeEventListener('change', handleFileChange);
    };
  }, []);

  const handleDeleteGraph = () => {
    setGraphData({ nodes: [], transitions: [] }); // Resetta il grafo
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.value = ''; // Resetta il valore dell'input file
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
    <title>Graph Manipulation Tool</title>
    <div className="max-w-6xl mx-auto">
      {/* Contenitore per il titolo e l'input file */}
      <div className="flex justify-between items-center mb-6 p-4 bg-white rounded shadow-md">
        <h1 className="text-2xl font-bold text-blue-600">FCM-based Maturity Model</h1>
        <div className="flex items-center gap-4">
          <input type="file" id="fileInput" className="p-2 border rounded" />
          <button
            onClick={handleDeleteGraph}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Delete Graph
          </button>
        </div>
      </div>

      {graphData.nodes.length > 0 && graphData.transitions.length > 0 ? (
        <>
          <Graph graphData={graphData} /> {/* Passa i dati al componente Graph */}
        </>
      ) : (
        <div className="mt-4 text-gray-500">Upload a JSON file to view the graph.</div>
      )}
    </div>
    </div>
  );
}

export default App;