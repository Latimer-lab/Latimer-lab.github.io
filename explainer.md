# Prompt Evaluation System UI - Complete Workflow Explanation

## System Overview
This is a web-based prompt evaluation system that allows users to create, edit, and evaluate prompts using AI grading. The system features a branching system where the highest-scoring prompt automatically becomes "main" and users can create branches from any existing prompt.

## Core UI Components

### 1. Layout Structure
The UI is divided into three main sections using CSS classes:
- `.instruction_header` - Contains title and file tabs
- `.instruction_main` - Contains the Monaco Editor for prompt editing
- `.instruction_footer` - Contains controls and action buttons

### 2. Initial State (Blank Canvas)
- **Default View**: When the page loads, users see a blank Monaco Editor
- **Branch Dropdown**: Shows "Blank" as the selected option
- **File Tabs**: Empty (no files attached)
- **Model Selection**: Defaults to "Auto Model"
- **Editor Content**: Empty text area ready for new prompt input

## User Workflow

### Step 1: Creating a New Prompt
1. User types their prompt in the blank Monaco Editor (without diffs just text regular)
2. User clicks "Evaluate" button
3. System prompts for a branch name (max 20 characters)
4. System creates a new branch with that name
5. Evaluation request is sent to Firestore
6. Worker processes the evaluation and stores results
7. Branch appears in the dropdown list
8. If this is the first prompt OR if it scores higher than current main, it becomes "main"

### Step 2: Branching from Existing Prompts
1. User selects a branch from the dropdown (Main, or any other branch)
2. Monaco Editor loads the content of that branch
3. User can edit the content
4. When "Evaluate" is clicked, system creates a new branch
5. New branch inherits the content from the selected branch
6. Auto-naming: "Branch of [parent_name] - [timestamp]"
7. Files are inherited from parent branch

### Step 3: File Management
1. **Adding Files**: Click "Add file" button opens a modal
   - Modal contains Monaco Editor for file content
   - User enters filename and content
   - Max 3 files per prompt
   - Files are stored with the prompt

2. **Editing Files**: 
   - File tabs appear in header when files exist
   - Clicking a tab shows file content in Monaco Editor
   - Content can be edited inline

3. **Deleting Files**: 
   - Delete button in file modal
   - Removes file from current prompt only

### Step 4: Model Selection
- Dropdown with options: "Auto Model", "GPT-4o mini", "Claude", "Gemini"
- Selection affects evaluation accuracy (±0.5 points)
- Default: "Auto Model"

## Technical Implementation Details

### Monaco Editor Setup
- Uses Monaco Editor CDN (version 0.45.0)
- Diff editor mode for comparing versions
- Word wrap enabled
- Read-only: false (users can edit)
- Height: 360px with border styling

### Firestore Integration
- **Collections**:
  - `prompts`: Stores prompt content, branch info, parent relationships
  - `evaluations`: Stores evaluation results and scores
  - `evaluation_requests`: Queue for worker processing
  - `prompt_files`: Stores attached file content

### Auto-Refresh System
- Firestore snapshots listen for changes
- Branch list updates automatically when new branches created
- No manual refresh button needed

### Evaluation Display
- When a branch is selected, previous evaluation summary appears
- Shows: Total score, individual scores (Accuracy, Reliability, Complexity)
- Shows strengths, weaknesses, and suggestions
- Evidence links to Discord messages (if any)

## Key Features

### Auto-Promotion System
- Highest-scoring prompt automatically becomes "main"
- Happens instantly when evaluation completes
- Main can never have a lower score than its branches

### Branch Naming Convention
- **Blank**: Empty canvas for new prompts
- **Main**: Highest-scoring prompt (auto-named)
- **User-created**: Custom names (max 20 chars)
- **Auto-generated**: "Branch of [parent] - [timestamp]"

### File Inheritance
- New branches inherit all files from parent
- Files can be added/removed on any branch
- Changes don't affect other branches

## CSS Classes and Styling
- Minimal styling approach
- Uses semantic class names
- Responsive design considerations
- Modal overlay for file editing
- Clean, modern interface

## Error Handling
- Graceful fallbacks for missing data
- Clear user feedback for actions
- Loading states during evaluation
- Error messages for failed operations

## State Management
- Current branch selection
- File attachments
- Model selection
- Editor content
- Evaluation status

This system provides a complete workflow for prompt creation, versioning, and AI-powered evaluation with automatic quality-based promotion and comprehensive file management.
