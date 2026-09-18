import React from 'react';

const ElementsList = ({ nodes, connectedNodeIds, onUpdateWeight, selectedNode, onSelectNode }) => {
  const connectedNodes = nodes.filter(node => connectedNodeIds.includes(node.id));

  const getWeightLabel = (weight) => {
    switch (weight) {
      case 'VL':
        return 'Very Low';
      case 'L':
        return 'Low';
      case 'M':
        return 'Medium';
      case 'H':
        return 'High';
      case 'VH':
        return 'Very High';
      default:
        return 'None';
    }
  };
  
  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 p-2 text-left">Node</th>
          <th className="border border-gray-300 p-2 text-left">Weight</th>
        </tr>
      </thead>
      <tbody>
        {connectedNodes.map(node => (
          <tr 
            key={node.id}
            className={`hover:bg-gray-50 ${selectedNode?.id === node.id ? 'bg-blue-100' : ''}`}
            onClick={() => onSelectNode(node)}
          >
            <td className="border border-gray-300 p-2">{node.meanings.join(', ')}</td>
            <td className="border border-gray-300 p-2">
              {selectedNode?.id === node.id ? (
                <select
                  value={node.weight ?? 'NA'}
                  onChange={(e) => onUpdateWeight(node.id, e.target.value)}
                  className="p-1 border rounded w-full"
                > 
                  <option value="NA" disabled>Select Weight</option>
                  <option value="VL">Very Low</option>
                  <option value="L">Low</option>
                  <option value="M">Medium</option>
                  <option value="H">High</option>
                  <option value="VH">Very High</option>
                </select>
              ) : (
                getWeightLabel(node.weight)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ElementsList;