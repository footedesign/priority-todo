# Priority To-Do App with Timeline

**Goal:** A functional, Dockerized to-do application with a timeline visualization of task order changes, with an Express API/frontend and a SQLite DB.

## Features

*   Add, edit, delete, and mark tasks as complete.
*   Drag-and-drop reordering of tasks.
*   Timeline tab visualizing the history of priority order changes using Chart.js.
*   Basic PIN protection for adding/editing tasks.
*   Dockerized for easy deployment and environment consistency.

## Technologies Used

*   **Backend:** Node.js, Express, SQLite (`sqlite3`), `dotenv`
*   **Frontend:** HTML, CSS, JavaScript, Chart.js, SortableJS (for drag & drop)
*   **Development/Deployment:** npm, Docker, Docker Compose

## Setup Instructions (Local Development)

1.  **Prerequisites:**
    *   Node.js (v18 or later recommended)
    *   npm (usually comes with Node.js)

2.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd priority-todo-app
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    ```

4.  **Configure Environment Variables:**
    *   Create a `.env` file in the `priority-todo-app` root directory.
    *   Add the following variables:
        ```dotenv
        PORT=4444  # Or any port you prefer
        APP_PIN=1234 # Set your desired PIN
        ```

5.  **Run the Application:**
    ```bash
    npm start
    ```
    The application should now be running at `http://localhost:4444` (or the port you specified).

## Docker Instructions

1.  **Prerequisites:**
    *   Docker Desktop (or Docker Engine + Docker Compose) installed and running.

2.  **Build and Run with Docker Compose:**
    *   Navigate to the `priority-todo-app` directory in your terminal.
    *   Ensure the `.env` file is present in this directory (Docker Compose will use it).
    *   Run the following command:
        ```bash
        docker-compose up --build
        ```
        *   `--build` forces Docker to rebuild the image if the `Dockerfile` or source code has changed.
        *   Use `docker-compose up -d` to run in detached mode (background).

3.  **Access the Application:**
    *   Open your web browser and go to `http://localhost:4444` (or the host port mapped in `docker-compose.yml`).

4.  **Stopping the Application:**
    *   Press `Ctrl + C` in the terminal where `docker-compose up` is running.
    *   If running in detached mode, use: `docker-compose down`

## API Endpoints

*   `GET /api/tasks`: Get all tasks (ordered by `task_order`).
*   `POST /api/tasks`: Create a new task. Requires `name` in the body and `pin` if authentication is enabled for adding.
*   `GET /api/tasks/:id`: Get a specific task by its ID.
*   `PUT /api/tasks/:id`: Updates an existing task (name, completed status, or task_order).
*   `DELETE /api/tasks/:id`: Delete a task by its ID.
*   `GET /api/history`: Get the task order history snapshots for the timeline view.
*   `POST /api/tasks/order`: Update the order of all tasks. Expects an array of task IDs (`taskIds`) in the request body representing the new order. Saves a snapshot to history.
*   `POST /verify-pin`: Verifies the provided PIN against the one stored in environment variables.

## Security Note

The PIN implementation provides basic protection against accidental changes in a personal setting. It is **not** secure and should not be used for protecting sensitive data against determined attackers.
