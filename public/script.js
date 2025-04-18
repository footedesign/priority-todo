document.addEventListener('DOMContentLoaded', () => {
  const taskList = document.getElementById('task-list');
  const newTaskInput = document.getElementById('new-task-input');
  const addTaskButton = document.getElementById('add-task-button');
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const timelineChartCanvas = document.getElementById('timeline-chart');
  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinSubmitButton = document.getElementById('pin-submit-button');
  const pinError = document.getElementById('pin-error');
  const pinModalCloseButton = document.getElementById('pin-modal-close-button');
  const editLockButton = document.getElementById('edit-lock-button');
  const filterControls = document.querySelector('.filter-controls');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const refreshTimelineBtn = document.getElementById('refresh-timeline-btn');
  const bodyElement = document.body;

  // --- State Variables ---
  let timelineChartInstance = null;
  let currentFilter = 'active';
  let currentPinAction = null;
  let sortableInstance = null;
  let verifiedPin = null;

  const API_BASE_URL = '/api';

  // --- PIN Modal Helper Functions ---

  /**
   * Opens the PIN modal and stores the action context.
   * @param {object} action - Object describing the action ({ type: 'add'/'edit'/'unlock', data: {...} })
   */
  const openPinModal = (action) => {
      currentPinAction = action; // Store the action (e.g., { type: 'unlock' })

      // Update modal text based on action
      const modalTitle = pinModal.querySelector('h2');
      const modalSubmitButton = pinModal.querySelector('#pin-submit-button');
      if (action.type === 'unlock') {
          modalTitle.textContent = 'Enter PIN to Unlock Editing';
          modalSubmitButton.textContent = 'Unlock';
      } else {
          // Keep original text or adapt for other potential future actions
           modalTitle.textContent = 'Enter PIN';
           modalSubmitButton.textContent = 'Submit';
      }

      pinInput.value = '';
      pinError.textContent = '';
      pinError.style.display = 'none';
      pinModal.style.display = 'flex';
      pinInput.focus();
  };

  /**
   * Closes the PIN modal and resets its state.
   */
  const closePinModal = () => {
      pinModal.style.display = 'none';
      pinInput.value = '';
      pinError.textContent = '';
      pinError.style.display = 'none';
      currentPinAction = null;
  };


  // --- UI Lock State Management (Simplified - CSS handles most) ---

  /**
   * Updates the lock state by toggling the body class and SortableJS state.
   * @param {boolean} isLocked - True to lock, false to unlock.
   */
  const updateUiLockState = (isLocked) => {
      bodyElement.classList.toggle('locked', isLocked);
      editLockButton.classList.toggle('unlocked', !isLocked);

      // Clear verified PIN when locking
      if (isLocked) {
          verifiedPin = null;
      }

      // Enable/Disable Drag and Drop
      if (sortableInstance) {
          sortableInstance.option('disabled', isLocked);
      }
  };

  // --- Task Filtering Logic ---

  /**
   * Applies the current filter to the task list, showing/hiding tasks as needed.
   */
  const applyFilter = () => {
      const tasks = taskList.querySelectorAll('li[data-task-id]'); // Get all actual task items
      let hasVisibleTasks = false;
      tasks.forEach(taskItem => {
          const isCompleted = taskItem.classList.contains('completed');
          let show = false;

          switch (currentFilter) {
              case 'all':
                  show = true;
                  break;
              case 'active':
                  show = !isCompleted;
                  break;
              case 'completed':
                  show = isCompleted;
                  break;
          }
          // Toggle visibility using style.display
          taskItem.style.display = show ? '' : 'none';
          if (show) {
              hasVisibleTasks = true;
          }
      });

      // Update active state on filter buttons
      filterBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.filter === currentFilter);
      });

      // Show placeholder if no tasks match the filter
      const placeholder = taskList.querySelector('.placeholder');
      if (placeholder) placeholder.remove(); // Remove existing placeholder first

      if (!hasVisibleTasks && tasks.length > 0) { // Only show if tasks exist but none match filter
           taskList.insertAdjacentHTML('beforeend', `<li class="placeholder" style="display: list-item;">No tasks match the "${currentFilter}" filter.</li>`);
      } else if (tasks.length === 0) { // Show default placeholder if no tasks exist at all
           taskList.innerHTML = '<li class="placeholder">No tasks yet. Add one!</li>';
      }
  };

  // --- Task Rendering Function ---

  /**
   * Creates and returns an HTML list item (<li>) element for a given task object.
   * Sets up event listeners for checkbox, edit (click on name), and delete button.
   * @param {object} task - The task object (e.g., { id: 1, name: '...', completed: false })
   * @returns {HTMLLIElement} The created list item element.
   */
  const renderTask = (task) => {
      const li = document.createElement('li');
      li.dataset.taskId = task.id;

      if (task.completed) {
          li.classList.add('completed');
      }

      // Create draggable area
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = `<svg style="width: 30px; height: 30px;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M12 6h.01M12 12h.01M12 18h.01"/></svg>`;

      // Create checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      checkbox.addEventListener('change', () => toggleTaskComplete(task.id, checkbox.checked));

      // Create span for task name (editable on click, if unlocked)
      const taskNameSpan = document.createElement('span');
      taskNameSpan.className = 'task-name';
      taskNameSpan.textContent = task.name;
      // Title and pointer events are handled by CSS based on body.locked
      taskNameSpan.addEventListener('click', () => {
          // Check lock state directly here
          if (!bodyElement.classList.contains('locked')) {
              makeTaskEditable(taskNameSpan, task.id);
          }
      });

      // Create delete button (visibility handled by CSS)
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.innerHTML = `<svg style="width: 18px; height: 18px;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M8.586 2.586A2 2 0 0 1 10 2h4a2 2 0 0 1 2 2v2h3a1 1 0 1 1 0 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a1 1 0 0 1 0-2h3V4a2 2 0 0 1 .586-1.414ZM10 6h4V4h-4v2Zm1 4a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Zm4 0a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Z" clip-rule="evenodd"/></svg>`;
      deleteButton.addEventListener('click', () => {
          // Check lock state directly here
           if (!bodyElement.classList.contains('locked')) {
               deleteTask(task.id);
           }
      });

      // Append elements to the list item
      li.appendChild(dragHandle);
      li.appendChild(checkbox);
      li.appendChild(taskNameSpan);
      li.appendChild(deleteButton);

      return li;
  };

  // --- In-Place Task Editing Logic ---

  /**
   * Makes a task name span editable in place.
   * Handles saving or reverting based on user actions (Enter, Escape, Blur).
   * Triggers the PIN modal for saving changes.
   * @param {HTMLSpanElement} spanElement - The span element containing the task name.
   * @param {number} taskId - The ID of the task being edited.
   */
  const makeTaskEditable = (spanElement, taskId) => {
      // Prevent editing if already editing this span or if locked
      if (spanElement.isContentEditable || bodyElement.classList.contains('locked')) {
          return;
      }

      const originalText = spanElement.textContent;
      spanElement.contentEditable = true;
      spanElement.classList.add('editing');
      spanElement.focus();

      // Handle ending the edit (on blur, Enter, or Escape)
      const handleEditEnd = (event) => {
          spanElement.contentEditable = false;
          spanElement.classList.remove('editing');
          const newText = spanElement.textContent.trim();

          // --- IMPORTANT: Remove listeners immediately to prevent memory leaks or duplicate calls ---
          spanElement.removeEventListener('blur', handleEditEnd);
          spanElement.removeEventListener('keydown', handleKeyDown);

          // If Escape was pressed, revert text and do nothing else
          if (event.type === 'keydown' && event.key === 'Escape') {
              spanElement.textContent = originalText;
              return;
          }

          // If text is not empty and actually changed
          if (newText && newText !== originalText) {
              // Directly update if unlocked, no PIN modal needed here anymore
              updateTask(taskId, { name: newText }, spanElement, originalText); // Pass span and original text for potential revert
          } else {
              // Revert if text is empty or unchanged
              spanElement.textContent = originalText;
          }
      };

      // Handle key presses during editing
      const handleKeyDown = (event) => {
          if (event.key === 'Enter') {
              event.preventDefault();
              handleEditEnd(event);
          } else if (event.key === 'Escape') {
              handleEditEnd(event);
          }
      };

      spanElement.addEventListener('blur', handleEditEnd);
      spanElement.addEventListener('keydown', handleKeyDown);
  };

  // --- Task Data Loading ---

  /**
   * Fetches tasks from the API and renders them in the task list.
   * Handles loading states and errors.
   */
  const loadTasks = async () => {
      try {
          const response = await fetch(`${API_BASE_URL}/tasks`);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          taskList.innerHTML = ''; // Clear current list (placeholders or old tasks)

          // Check if tasks were returned and render them
          if (data.tasks && data.tasks.length > 0) {
              data.tasks.forEach(task => {
                  taskList.appendChild(renderTask(task));
              });
          } else {
              taskList.innerHTML = '<li class="placeholder">No tasks yet. Add one!</li>';
          }
      } catch (error) {
          console.error('Error loading tasks:', error);
          taskList.innerHTML = '<li class="placeholder error">Could not load tasks. Check connection or server.</li>';
      }
  };

  // --- Task Actions (Add, Edit, Delete, Complete) ---

  /**
   * Handles the "Add Task" button click or Enter key press in the input.
   * Handles the "Add Task" button click or Enter key press in the input.
   * Calls createTask directly if not locked.
   */
  const addTaskAction = () => {
      if (bodyElement.classList.contains('locked')) return; // Do nothing if locked

      const taskName = newTaskInput.value.trim();
      if (!taskName) {
          alert('Please enter a task name.');
          return;
      }
      // Directly call createTask, no PIN modal needed here anymore
      createTask(taskName);
  };

  /**
   * Handles the submission of the PIN from the modal, specifically for the 'unlock' action.
   * Verifies the PIN via the API and updates the UI lock state.
   */
  const handlePinSubmit = async () => {
      const pin = pinInput.value;
      // Only proceed if the action is 'unlock'
      if (!pin || !currentPinAction || currentPinAction.type !== 'unlock') {
          pinError.textContent = 'PIN is required.';
          pinError.style.display = 'block';
          return;
      }

      pinError.style.display = 'none';

      // API call to verify the PIN
      try {
          const response = await fetch(`${API_BASE_URL}/verify-pin`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-PIN': pin // Send the PIN in the header
              }
              // No body needed for verification
          });

          if (response.ok) {
              // PIN is correct, store it and unlock the UI
              verifiedPin = pin; // Store the verified PIN
              updateUiLockState(false); // false means unlock (removes body.locked)
              closePinModal(); // Close the modal on success
          } else if (response.status === 401 || response.status === 403) {
              // PIN is incorrect
              verifiedPin = null; // Ensure PIN is cleared on failure
              const errorResult = await response.json();
              pinError.textContent = errorResult.message || 'Invalid PIN.';
              pinError.style.display = 'block';
              pinInput.focus();
              pinInput.select();
          } else {
               const errorResult = await response.json();
               pinError.textContent = `Error: ${errorResult.message || response.statusText}`;
               pinError.style.display = 'block';
               console.error('API Error during PIN verification:', response.status, errorResult);
          }

      } catch (error) {
          console.error('Error during PIN verification:', error);
          pinError.textContent = 'A network error occurred. Please try again.';
          pinError.style.display = 'block';
      }
  };

  /**
   * Creates a new task via API call.
   * @param {string} name - The name of the task to create.
   */
  const createTask = async (name) => {
      if (!verifiedPin) {
          console.error("Attempted to create task without a verified PIN.");
          alert("PIN not verified. Please unlock editing.");
          return;
      }
      try {
          const response = await fetch(`${API_BASE_URL}/tasks`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Pin': verifiedPin
              },
              body: JSON.stringify({ name }),
          });
          if (response.ok) {
              const result = await response.json();
              if (result.task) {
                  const placeholder = taskList.querySelector('.placeholder');
                  if (placeholder) placeholder.remove();
                  taskList.appendChild(renderTask(result.task));
                  newTaskInput.value = ''; // Clear input on success
                  // No need to call updateUiLockState here, adding is only possible when unlocked
              }
          } else {
              const errorResult = await response.json();
              alert(`Failed to add task: ${errorResult.message || response.statusText}`);
          }
      } catch (error) {
          console.error('Error creating task:', error);
          alert('Failed to add task due to a network error.');
      }
  };

  /**
   * Updates an existing task (e.g., name) via API call.
   * @param {number} taskId - The ID of the task to update.
   * @param {object} updates - An object containing the fields to update (e.g., { name: 'New Name' }).
   * @param {HTMLSpanElement} [spanElement] - Optional: The span element being edited, for reverting on error.
   * @param {string} [originalText] - Optional: The original text of the span, for reverting on error.
   */
  const updateTask = async (taskId, updates, spanElement = null, originalText = null) => {
       if (!verifiedPin) {
           console.error("Attempted to update task without a verified PIN.");
           alert("PIN not verified. Please unlock editing.");
           // Revert optimistic UI update if applicable
           if (spanElement && originalText !== null) {
               spanElement.textContent = originalText;
           }
           return;
       }
      try {
          const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Pin': verifiedPin
              },
              body: JSON.stringify(updates),
          });
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          // Success: The name is already updated optimistically in the span by makeTaskEditable
          // If updating other fields, update UI here based on response.
      } catch (error) {
          console.error(`Error updating task ${taskId}:`, error);
          alert('Failed to update task.');
          // Revert optimistic UI update on error if spanElement and originalText were provided
          if (spanElement && originalText !== null) {
              spanElement.textContent = originalText;
          }
      }
  };


  /**
   * Deletes a task after confirmation. Makes a DELETE request to the API.
   * Only proceeds if editing is unlocked.
   * @param {number} taskId - The ID of the task to delete.
   */
  const deleteTask = async (taskId) => {
      // Check lock state first
      if (bodyElement.classList.contains('locked')) {
          alert('Please unlock editing to delete tasks.');
          return;
      }

      if (!confirm('Are you sure you want to delete this task?')) {
          return;
      }

      if (!verifiedPin) {
          console.error("Attempted to delete task without a verified PIN.");
          alert("PIN not verified. Please unlock editing.");
          return;
      }

      try {
          // Make DELETE request to the backend
          const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
              method: 'DELETE',
              headers: {
                  'X-Pin': verifiedPin
              }
          });

          if (!response.ok) {
               if (response.status === 404) {
                  alert('Task not found. It might have already been deleted.');
               } else {
                  throw new Error(`HTTP error! status: ${response.status}`);
               }
          } else {
              // Remove the task item from the list visually
              const taskItem = taskList.querySelector(`li[data-task-id="${taskId}"]`);
              if (taskItem) {
                  taskItem.remove();
              }
              // If list becomes empty, show the placeholder message
              if (taskList.children.length === 0) {
                  taskList.innerHTML = '<li class="placeholder">No tasks yet. Add one!</li>';
              }
          }
      } catch (error) {
          console.error(`Error deleting task ${taskId}:`, error);
          alert('Failed to delete task. Please try again.');
      }
  };

  /**
   * Toggles the completion status of a task. Makes a PUT request to the API.
   * No PIN is required for toggling completion status.
   * @param {number} taskId - The ID of the task to toggle.
   * @param {boolean} isCompleted - The new completion status (true or false).
   */
  const toggleTaskComplete = async (taskId, isCompleted) => {
      // Check lock state first
      if (!verifiedPin) {
          console.error("Attempted to toggle task completion without a verified PIN.");
          // Revert checkbox optimistically
          const taskItem = taskList.querySelector(`li[data-task-id="${taskId}"]`);
          const checkbox = taskItem?.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.checked = !isCompleted;
          alert("PIN not verified. Please unlock editing to modify tasks.");
          return;
      }

      try {
          // Make PUT request, sending 'completed' field and PIN header
          const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Pin': verifiedPin
              },
              body: JSON.stringify({ completed: isCompleted }),
          });

           if (!response.ok) {
               throw new Error(`HTTP error! status: ${response.status}`);
           }

          const result = await response.json();
           if (result.task) {
               // Update the visual state of the task item
               const taskItem = taskList.querySelector(`li[data-task-id="${taskId}"]`);
               if (taskItem) {
                   taskItem.classList.toggle('completed', result.task.completed);
                   const checkbox = taskItem.querySelector('input[type="checkbox"]');
                   if (checkbox) checkbox.checked = result.task.completed;
               }
               applyFilter(); // Re-apply filter after completion change
           } else {
               console.error('Task update response did not include task object:', result);
               alert('Task status updated, but failed to refresh visual state.');
           }

      } catch (error) {
          console.error(`Error updating task ${taskId} status:`, error);
          alert('Failed to update task status. Please try again.');
          // Attempt to revert visual state on error for better UX
          const taskItem = taskList.querySelector(`li[data-task-id="${taskId}"]`);
          const checkbox = taskItem?.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.checked = !isCompleted;
      }
  };

  // --- Tab Switching Logic ---

  /**
   * Handles switching between the 'Tasks' and 'Timeline' tabs.
   * Updates active classes and loads data for the selected tab.
   * @param {string} targetTabId - The ID of the tab to switch to ('tasks' or 'timeline').
   */
  const switchTab = (targetTabId) => {
      // Remove 'active' class from all tab content areas and tab buttons
      tabContents.forEach(content => content.classList.remove('active'));
      tabs.forEach(tab => tab.classList.remove('active'));

      // Add 'active' class to the target tab content and button
      document.getElementById(`${targetTabId}-tab`).classList.add('active');
      document.querySelector(`.tab-button[data-tab="${targetTabId}"]`).classList.add('active');

      // Load data specifically for the activated tab
      if (targetTabId === 'tasks') {
          loadTasks().then(() => {
              applyFilter(); // Re-apply filter after loading tasks
          });
      } else if (targetTabId === 'timeline') {
          loadTimelineData();
      }
  };

  // --- Timeline Chart Logic ---

  /**
   * Fetches both task history and current task data required for the timeline chart.
   * Processes the data and calls the rendering function.
   * Handles errors during data fetching.
   */
  const loadTimelineData = async () => {
      try {
          // Fetch history and current tasks concurrently
          const [historyResponse, tasksResponse] = await Promise.all([
              fetch(`${API_BASE_URL}/history`),
              fetch(`${API_BASE_URL}/tasks`)
          ]);

          if (!historyResponse.ok) throw new Error(`History fetch error! status: ${historyResponse.status}`);
          if (!tasksResponse.ok) throw new Error(`Tasks fetch error! status: ${tasksResponse.status}`);

          const historyData = await historyResponse.json();
          const tasksData = await tasksResponse.json();

          // Create a map of task IDs to task names for chart labels
          const taskNameMap = tasksData.tasks.reduce((map, task) => {
              map[task.id] = task.name;
              return map;
          }, {});

          // Render the chart with the fetched data
          renderTimelineChart(historyData.history, taskNameMap);

      } catch (error) {
          console.error('Error loading timeline data:', error);
           // Clean up existing chart instance if it exists
           if (timelineChartInstance) {
               timelineChartInstance.destroy();
               timelineChartInstance = null;
           }
           // Display an error message on the canvas
           const ctx = timelineChartCanvas?.getContext('2d');
           if (ctx) {
               ctx.clearRect(0, 0, timelineChartCanvas.width, timelineChartCanvas.height);
               ctx.font = '16px Arial';
               ctx.fillStyle = 'red';
               ctx.textAlign = 'center';
               ctx.fillText('Could not load timeline data.', timelineChartCanvas.width / 2, timelineChartCanvas.height / 2);
           }
      }
  };

  /**
   * Renders the timeline chart using Chart.js.
   * Processes history data into datasets suitable for a line chart.
   * @param {Array} history - Array of history entries from the API.
   * @param {object} taskNameMap - Map of task IDs to task names.
   */
  const renderTimelineChart = (history, taskNameMap) => {
      // Ensure canvas element exists and Chart.js library is loaded
      if (!timelineChartCanvas || typeof Chart === 'undefined') {
          console.error("Timeline canvas or Chart.js not found.");
          return;
      }

      // Destroy previous chart instance if it exists to prevent memory leaks
      if (timelineChartInstance) timelineChartInstance.destroy();

      // --- Data Processing for Chart.js ---
      const datasets = {};
      const allTimestamps = new Set();

      // Iterate through each history snapshot
      history.forEach(entry => {
          const timestamp = new Date(entry.timestamp).toISOString(); // Use ISO string for Chart.js time scale
          allTimestamps.add(timestamp);
          // Iterate through the task IDs in the snapshot order
          entry.task_order_snapshot.forEach((taskId, index) => {
              const rank = index + 1; // Rank is 1-based index
              // Initialize dataset for this task if it doesn't exist
              if (!datasets[taskId]) {
                  datasets[taskId] = {
                      label: taskNameMap[taskId] || `Task ${taskId}`,
                      data: [],
                      fill: false,
                      tension: 0.1, // Slight curve to the line
                      borderColor: getRandomColor()
                  };
              }
              // Add the data point (timestamp, rank) for this task
              datasets[taskId].data.push({ x: timestamp, y: rank });
          });
      });

      // Sort data points within each dataset chronologically (important for line charts)
      Object.values(datasets).forEach(ds => {
          ds.data.sort((a, b) => new Date(a.x) - new Date(b.x));
      });

      // Final data structure for Chart.js
      const chartData = { datasets: Object.values(datasets) };

      // --- Chart.js Configuration ---
      const config = {
          type: 'line',
          data: chartData,
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  title: { display: true, text: 'Task Rank Over Time' },
                  tooltip: {
                      mode: 'index', // Show tooltips for all datasets at the hovered index (timestamp)
                      intersect: false, // Tooltip appears even if not directly hovering over a point
                      callbacks: {
                          label: (context) => `Rank ${context.parsed.y} (${context.dataset.label})`
                      }
                  }
              },
              scales: {
                  x: {
                      type: 'time',
                      time: {
                          unit: 'week',
                          // tooltipFormat: 'PPpp'
                      },
                      title: { display: true, text: 'Date' }
                  },
                  y: { // Y-axis (Rank)
                      title: { display: true, text: 'Rank (Lower is Higher Priority)' },
                      reverse: true, // Reverse scale so rank 1 is at the top
                      ticks: { stepSize: 1 },
                      min: 1 // Start Y-axis at rank 1
                  }
              },
              interaction: {
                  mode: 'nearest',
                  intersect: false
              }
          }
      };

      // Create the new Chart instance
      timelineChartInstance = new Chart(timelineChartCanvas, config);
  };

  /**
   * Helper function to generate random hex colors for chart lines.
   * @returns {string} A random hex color code (e.g., '#A3B1C4').
   */
  const getRandomColor = () => {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
  };


  // --- Setup Event Listeners ---
  addTaskButton.addEventListener('click', addTaskAction);

  // Add Task Listener (Enter Key in Input)
  newTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          addTaskAction();
      }
  });

  tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  pinSubmitButton.addEventListener('click', handlePinSubmit);
  pinInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          handlePinSubmit();
      }
  });

  pinModalCloseButton.addEventListener('click', closePinModal);
  // Close modal if user clicks on the background overlay
  pinModal.addEventListener('click', (event) => {
      if (event.target === pinModal) {
          closePinModal();
      }
  });

  // Edit Lock Button Listener
  editLockButton.addEventListener('click', () => {
      if (bodyElement.classList.contains('locked')) {
          // If currently locked, open PIN modal to unlock
          openPinModal({ type: 'unlock' });
      } else {
          // If currently unlocked, lock it immediately
          updateUiLockState(true); // true means lock (adds body.locked)
      }
  });

  // Filter button listeners
  filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          currentFilter = btn.dataset.filter;
          applyFilter();
      });
  });


  // --- Drag and Drop Initialization ---

  /**
   * Saves the new task order to the backend API after a drag-and-drop operation.
   * @param {Array<string>} orderedTaskIds - An array of task IDs in their new order.
   */
  const saveTaskOrder = async (orderedTaskIds) => {
      // Check lock state first
      if (bodyElement.classList.contains('locked')) {
          console.warn('Attempted to save task order while locked. Reverting.');
          loadTasks(); // Revert visual order by reloading
           return;
       }

       if (!verifiedPin) {
           console.error("Attempted to save task order without a verified PIN.");
           alert("PIN not verified. Please unlock editing.");
           loadTasks(); // Revert visual order
           return;
       }

       console.log('Attempting to save new task order:', orderedTaskIds);
       try {
           const response = await fetch(`${API_BASE_URL}/tasks/order`, {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
                   'X-Pin': verifiedPin
               },
               body: JSON.stringify({ taskOrder: orderedTaskIds }),
           });
           if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const result = await response.json();
          console.log('Task order saved successfully:', result.message);
          // If the timeline tab is currently active, reload its data to show the new history entry
          if (document.getElementById('timeline-tab').classList.contains('active')) {
              loadTimelineData();
          }
      } catch (error) {
          console.error('Error saving task order:', error);
          alert('Failed to save the new task order. Reverting visual order.');
          loadTasks();
      }
  };

  /**
   * Initializes drag-and-drop functionality on the task list using SortableJS.
   */
  const initializeDragAndDrop = () => {
      if (typeof Sortable === 'undefined') {
          console.error('SortableJS library is not loaded! Drag and drop disabled.');
          return;
      }
      // Initialize SortableJS and store the instance
      sortableInstance = new Sortable(taskList, {
          animation: 150,
          ghostClass: 'dragging',
          disabled: bodyElement.classList.contains('locked'), // Initially disable based on body class

          onEnd: function (evt) {
              const orderedItems = Array.from(taskList.children);
              // Extract task IDs from the data attributes in the new order
              const orderedTaskIds = orderedItems
                  .map(item => item.dataset.taskId)
                  .filter(id => id);

              // If we have a valid list of IDs, save the new order
              if (orderedTaskIds.length > 0) {
                  saveTaskOrder(orderedTaskIds);
              }
          },
      });
  };

  // --- Initial Application Load ---
  // Load tasks first, then initialize drag and drop, then set initial lock state
  loadTasks().then(() => {
      applyFilter(); // Apply the current filter after rendering
      initializeDragAndDrop();
      updateUiLockState(true); // Start locked
  });

});
