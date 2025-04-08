import { useState, useEffect } from 'react';
// Import HighlightedAction from the root directory (assuming build process handles TSX)
// Ideally, move text-qualifier.tsx to frontend/src/components/
import { HighlightedAction } from '../../text-qualifier'; // Adjust path as needed
// Removed TypeScript type imports

// Removed EditorAction type definition

// Define qualifier options (can be fetched or passed as props later)
const qualifierOptions = [ // Removed QualifierOption[] type annotation
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "scheduled", label: "Scheduled" },
];

// Define the pattern and name for actions
const actionPattern = /<action>/g; // Example pattern
const actionName = "Action"; // Example name

const ContentEditor = () => {
  // Set initial content with an action placeholder
  const [content, setContent] = useState('This is a test <action> for the editor.');
  const [status, setStatus] = useState('');
  const [actions, setActions] = useState([]); // Removed <EditorAction[]> type annotation

  // Log when the component mounts
  useEffect(() => {
    console.log("ContentEditor component mounted!");
  }, []);

  // Temporarily disable fetching/saving - needs rework for structured content
  // useEffect(() => {
  //   fetchContent();
  // }, []);

  // const fetchContent = async () => {
  //   try {
  //     const res = await fetch('http://localhost:3000/api/content');
  //     const data = await res.json();
  //     setContent(data.content);
  //   } catch (err) {
  //     setStatus('Failed to fetch content');
  //   }
  // };

  // Update actions whenever content changes
  useEffect(() => {
    const matches = [...content.matchAll(actionPattern)];
    setActions(prevActions => {
      return matches.map((match, index) => {
        // Try to find existing action state based on index - simplistic approach
        // Ensure prevActions is treated as an array
        const existingAction = Array.isArray(prevActions)
          ? prevActions.find(a => a.matchIndex === match.index)
          : undefined;
        return {
          id: `action-${match.index}`, // Use match index for a more stable ID
          name: actionName,
          selectedQualifier: existingAction?.selectedQualifier || qualifierOptions[0].id,
          matchIndex: match.index, // Removed 'as number' assertion
        };
      });
    });
  }, [content]);


  // const updateContent = async () => {
    // This needs to be rewritten to handle the structured content + actions state
  //   try {
  //     // ... existing fetch logic ...
  //   } catch (err) {
  //     setStatus('Failed to save');
  //   }
  // };

  const handleQualifierChange = (actionId, qualifierId) => { // Removed type annotations
    setActions(prevActions =>
      prevActions.map(action =>
        action.id === actionId ? { ...action, selectedQualifier: qualifierId } : action
      )
    );
    // Optional: Log or trigger other side effects
    console.log(`Action ${actionId} qualifier changed to ${qualifierId}`);
  };

  // Function to render content with highlighted actions
  const renderContentWithActions = () => {
    const segments = []; // Removed React.ReactNode[] type annotation
    let lastIndex = 0;
    // Ensure actions is treated as an array before sorting
    const currentActions = Array.isArray(actions)
      ? [...actions].sort((a, b) => a.matchIndex - b.matchIndex)
      : [];

    currentActions.forEach((action) => {
      const matchIndex = action.matchIndex;
      // Correctly calculate match length using the regex source - requires escaping special chars if any
      // For a simple string like '<action>', length is fine. For complex regex, this needs care.
      const placeholderString = '<action>'; // Assuming this is the literal placeholder
      const matchLength = placeholderString.length;

       // Add text before the action
       if (matchIndex > lastIndex) {
         segments.push(content.substring(lastIndex, matchIndex));
       }

       // Add the highlighted action with dropdown
       segments.push(
         <HighlightedAction
           key={action.id}
           action={action} // Pass the action object
           qualifierOptions={qualifierOptions}
           onChange={(qualifierId) => handleQualifierChange(action.id, qualifierId)}
         />
       );

       lastIndex = matchIndex + matchLength; // Move past the placeholder length
    });

     // Add remaining text
     if (lastIndex < content.length) {
       segments.push(content.substring(lastIndex));
     }

     // Handle empty content case
     if (segments.length === 0 && content.length === 0) {
         return <span className="text-gray-400">Start typing...</span>;
     }
     // If no actions but text exists
     if (segments.length === 0 && content.length > 0) {
       return content;
     }


     return segments;
   };


  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-2">Content Input</h2>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your text here, use <action> for placeholders..."
        className="w-full h-48 p-2 border rounded mb-4"
      />

      <h2 className="text-xl font-semibold mb-2">Rendered Output</h2>
      <div className="p-4 border rounded-md bg-gray-50 min-h-[100px] relative">
        {renderContentWithActions()}
      </div>

      {/* Keep save button/status but note it's not functional yet */}
      <div className="mt-4 flex justify-between">
        <button
          // onClick={updateContent} // Disabled for now
          disabled // Disable button until saving is implemented
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          Save (Disabled)
        </button>
        <span className="py-2 text-gray-600">{status}</span>
      </div>
    </div>
  );
};

export default ContentEditor;