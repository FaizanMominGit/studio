# **App Name**: CampusConnect Attendance

## Core Features:

- Secure Login: Secure login using Microsoft Outlook (Azure AD) credentials for students and professors.
- Role-Based Dashboards: Role-based dashboards for professors and students, providing distinct functionalities and views.
- Lecture Session Management: Professors can create and manage lecture sessions, inputting details like department, year, division, subject, and time.
- QR Code Generation: Generation of a unique QR code for each lecture session that directs students to the attendance page.
- Geolocation Attendance: Students scan the QR code to access the attendance page and must be within a 15-meter radius of the professor's location for attendance to be marked.
- AI-Powered Face Recognition: The app will leverage face recognition as a tool to confirm the identify of the student marking attendance. Students will first need to take a picture of themselves to register. 
- Offline Attendance Recording: Offline attendance recording for professors. Professors can mark attendance even when the app can't reach the network.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust, authority, and a professional academic feel.
- Background color: Light blue (#E8EAF6), a very desaturated shade of the primary, creates a calm and clean backdrop.
- Accent color: Purple (#7E57C2), an analogous color that provides visual interest for interactive elements, and to make important features stand out.
- Font: 'Inter' (sans-serif) for all body and header text, ensuring readability and a modern, clean aesthetic. 
- lucide-react will provide simple and consistent icons throughout the interface, enhancing user understanding and interaction.
- Responsive design using Tailwind CSS to adapt to various screen sizes, providing an optimal user experience on desktop, tablet, and mobile devices.
- Loading animations to clearly indicate when operations are underway. Smooth transitions throughout the app provide visual feedback and a polished user experience.