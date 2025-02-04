import DraggableList from './components/DraggableList'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6 text-center">Draggable Tasks</h1>
        <DraggableList />
      </div>
    </div>
  )
}

export default App