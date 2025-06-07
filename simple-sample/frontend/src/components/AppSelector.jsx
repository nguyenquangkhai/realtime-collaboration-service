import React, { useState } from 'react';

const AppSelector = ({ onSelectApp, initialRoomName = '' }) => {
  const [selectedRoom, setSelectedRoom] = useState(initialRoomName);

  const apps = [
    {
      id: 'text',
      name: 'Text Editor',
      description: 'Collaborative text editing with Quill',
      icon: '📝',
      color: 'from-blue-50 to-blue-100 border-blue-200'
    },
    {
      id: 'nodes',
      name: 'Node Diagram', 
      description: 'Collaborative node diagrams with React Flow',
      icon: '🔗',
      color: 'from-green-50 to-green-100 border-green-200'
    },
    {
      id: 'table',
      name: 'Table Editor',
      description: 'Collaborative spreadsheet editing with React Datasheet', 
      icon: '📋',
      color: 'from-purple-50 to-purple-100 border-purple-200'
    }
  ];

  const handleAppSelect = (appType) => {
    const roomName = selectedRoom || `default-room-${Date.now()}`;
    onSelectApp(appType, roomName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-12 py-8 bg-white shadow-lg rounded-2xl border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🚀 Collaborative Workspace
          </h1>
          <p className="text-gray-600 mt-2 text-lg">Choose your collaboration tool and start working together</p>
        </div>

        {/* Room Input Section */}
        <div className="mb-12 flex justify-center">
          <div className="w-full max-w-md bg-white shadow-lg rounded-2xl border border-gray-100 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
              📝 Room Name
            </label>
            <input
              type="text"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              placeholder="Enter room name..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center transition-all duration-200 hover:border-gray-300"
            />
          </div>
        </div>

        {/* App Cards Grid */}
        <div className="grid grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
          {apps.map((app) => (
            <div 
              key={app.id} 
              className={`bg-gradient-to-br ${app.color} shadow-lg hover:shadow-xl rounded-2xl p-8 flex flex-col items-center text-center min-h-[320px] transition-all duration-300 hover:scale-105 cursor-pointer border-2`}
              onClick={() => handleAppSelect(app.id)}
            >
              {/* App Icon */}
              <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center mb-6 text-3xl">
                {app.icon}
              </div>
              
              {/* App Title */}
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {app.name}
              </h3>
              
              {/* App Description */}
              <p className="text-gray-600 text-sm leading-relaxed mb-8 flex-grow">
                {app.description}
              </p>
              
              {/* Go to App Button */}
              <button 
                className="w-full py-3 px-6 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
              >
                Go to app →
              </button>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center">
          <div className="bg-white shadow-lg rounded-2xl border border-gray-100 p-8 max-w-4xl mx-auto">
            <h4 className="text-2xl font-bold text-gray-800 mb-6">How it works</h4>
            <div className="grid grid-cols-4 gap-6 text-sm">
              {[
                { step: 1, title: "Choose an app", desc: "Select your preferred collaboration tool" },
                { step: 2, title: "Enter room name", desc: "Create or join an existing room" },
                { step: 3, title: "Share URL", desc: "Invite others with the room link" },
                { step: 4, title: "Collaborate", desc: "Work together in real-time" }
              ].map((item) => (
                <div key={item.step} className="p-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold shadow-lg">
                    {item.step}
                  </div>
                  <h5 className="font-semibold text-gray-800 mb-2">{item.title}</h5>
                  <p className="text-gray-600 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AppSelector; 