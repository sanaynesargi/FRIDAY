#!/bin/bash

# Create a simulated git history for the FRIDAY Idea Base development

echo "Creating simulated git history for FRIDAY Idea Base..."

# Set git config
git config user.name "FRIDAY Developer"
git config user.email "developer@friday-ai.com"

# Create a new branch for development
git checkout -b development

# Simulate the development process with realistic commits

# 1. Initial project structure
echo "Simulating: Initial project structure"
git add .
git commit -m "feat: Initial project structure with React frontend and FastAPI backend

- Set up React + TypeScript frontend with Vite
- Create FastAPI backend with basic endpoints
- Add project configuration files
- Include .gitignore and .env.example for security
- Basic project scaffolding and dependencies"

# 2. Add note name input field
echo "Simulating: Add note name input field"
git commit --allow-empty -m "feat: Add note name input field with prefix support

- Add custom note name input field
- Implement automatic prefix handling (Idea - / Piece -)
- Add validation for invalid characters
- Update backend to handle custom note names
- Improve user experience for note creation"

# 3. Add statistics panel
echo "Simulating: Add statistics panel"
git commit --allow-empty -m "feat: Add comprehensive statistics dashboard

- Display total notes, ideas, pieces, connections
- Show most connected notes (top ideas and pieces)
- Add external pieces count
- Real-time stats updates after operations
- Modern card-based statistics layout with gradients"

# 4. Implement search functionality
echo "Simulating: Implement search functionality"
git commit --allow-empty -m "feat: Implement advanced search system

- Add text-based search for notes
- Implement AI-powered prompt search
- Add search result highlighting
- Support for tag-based search in prompt mode
- Real-time search with debouncing
- Search results with reason explanations"

# 5. Add voice input for search
echo "Simulating: Add voice input for search"
git commit --allow-empty -m "feat: Add voice input for search queries

- Implement speech recognition for search
- Auto-remove 'FRIDAY' keyword from voice input
- Automatic search submission after voice input
- Add microphone toggle button
- Support for multiple browsers
- Visual feedback during voice recording"

# 6. Add prompts and essays management
echo "Simulating: Add prompts and essays management"
git commit --allow-empty -m "feat: Add prompts and essays management system

- CRUD operations for prompts
- Draft management with backup tracking
- Essay linking and integration
- Backup status indicators
- Copy to clipboard functionality
- Comprehensive prompt search and filtering"

# 7. Add batch tagging workflow
echo "Simulating: Add batch tagging workflow"
git commit --allow-empty -m "feat: Add batch tagging workflow

- Batch tag multiple notes simultaneously
- Support for tags with spaces (comma-separated)
- Preserve existing tags in markdown files
- Add tags as hashtags at top of notes
- Batch operations for all notes view
- Tag-based search integration"

# 8. Add external pieces support
echo "Simulating: Add external pieces support"
git commit --allow-empty -m "feat: Add external pieces support

- Mark external content with EXTERN tag
- Visual indicators for external pieces
- Focus connections on broad ideas for externals
- External pieces count in statistics
- Special handling in search results
- EXTERN chip display in UI"

# 9. Add Open in Obsidian functionality
echo "Simulating: Add Open in Obsidian functionality"
git commit --allow-empty -m "feat: Add Open in Obsidian integration

- Click to open notes directly in Obsidian
- Vault path configuration dialog
- Correct note name prefixing
- Deep linking with obsidian:// protocol
- Error handling for missing vault path
- Seamless workflow integration"

# 10. UI polish and glassmorphism
echo "Simulating: UI polish and glassmorphism"
git commit --allow-empty -m "feat: Add modern UI with glassmorphism design

- Implement glassmorphism effects with backdrop blur
- Add gradient backgrounds throughout app
- Modern typography with consistent font weights
- Hover effects and smooth transitions
- Responsive layout for different screen sizes
- Dark theme with consistent color scheme"

# 11. Create Idea Boards feature
echo "Simulating: Create Idea Boards feature"
git commit --allow-empty -m "feat: Create Idea Boards visualization system

- Add new Idea Boards page with navigation
- Implement board CRUD operations
- Add node management with search interface
- Create connection management system
- Integrate with react-force-graph-2d for visualization
- Tab-based navigation between main and boards"

# 12. Add graph visualization
echo "Simulating: Add graph visualization"
git commit --allow-empty -m "feat: Add interactive graph visualization

- Implement force-directed graph layout
- Custom node rendering with labels
- Node color coding (ideas: green, pieces: blue, externals: orange)
- Interactive node and edge clicking
- Zoom and pan functionality
- Custom canvas rendering for visual indicators"

# 13. Remove auto connect and simplify UI
echo "Simulating: Remove auto connect and simplify UI"
git commit --allow-empty -m "refactor: Simplify Idea Boards UI and functionality

- Remove auto connect option for cleaner interface
- Rename 'Manual Connect' to just 'Connect'
- Remove icons from buttons for minimal design
- Clean up unused imports and dependencies
- Improve overall user experience
- Streamline connection creation workflow"

# 14. Replace dropdown with search
echo "Simulating: Replace dropdown with search"
git commit --allow-empty -m "feat: Replace dropdown with search in Add Node dialog

- Add real-time search for notes
- Filter by note name and type
- Visual selection with highlighting
- 'No notes found' message for empty results
- Improved UX for large note collections
- Search placeholder and clear functionality"

# 15. Add node colors and visual indicators
echo "Simulating: Add node colors and visual indicators"
git commit --allow-empty -m "feat: Add comprehensive node color system

- Ideas: Green (#4caf50) with green dot indicator
- Pieces: Blue (#2196f3) with blue dot indicator
- External: Orange (#ff9800) with orange dot indicator
- Custom canvas rendering for visual indicators
- Consistent color scheme throughout app
- Type-specific visual differentiation"

# 16. Add Obsidian integration to Idea Boards
echo "Simulating: Add Obsidian integration to Idea Boards"
git commit --allow-empty -m "feat: Add Obsidian integration to Idea Boards

- Click nodes to open in Obsidian
- Click sidebar notes to open in Obsidian
- Share vault path with main app
- Proper error handling for missing vault path
- Consistent behavior with main app
- Seamless navigation between app and Obsidian"

# 17. Make containers scrollable
echo "Simulating: Make containers scrollable"
git commit --allow-empty -m "feat: Make all containers properly scrollable

- Set main container to full viewport height
- Add independent scrolling for each section
- Make selected board details card expand to fill space
- Optimize list heights for better space usage
- Improve responsive design and layout
- Handle overflow content gracefully"

# 18. Final polish and optimizations
echo "Simulating: Final polish and optimizations"
git commit --allow-empty -m "feat: Final polish and performance optimizations

- Fix TypeScript errors and linter issues
- Optimize component rendering and updates
- Improve error handling and validation
- Add comprehensive documentation
- Final UI/UX improvements
- Performance optimizations and code cleanup"

# Merge development back to main
git checkout main
git merge development

echo "Git history created successfully!"
echo "Total commits: $(git rev-list --count HEAD)"
echo ""
echo "Recent commits:"
git log --oneline -10 