# User Management APIs - Postman Collection

This directory contains Postman collections for testing the User Management APIs in the Neet ChamP Backend application.

## Collections Available

### 1. `User-Management-APIs.postman_collection.json`
A standalone collection focused specifically on User Management endpoints with comprehensive documentation and test cases.

### 2. `Neet-ChamP-Backend-APIs.postman_collection.json` (Updated)
The complete backend API collection now includes the User Management section alongside all other APIs.

## API Endpoints Included

### User Profile Management
- **GET** `/api/user/profile` - Get current user profile
- **PUT** `/api/user/profile` - Update user profile (name, email)
- **PUT** `/api/user/password` - Change user password

### User Statistics
- **GET** `/api/user/stats` - Get role-based user statistics
  - **Teachers**: Quizzes created, students enrolled, classes taught, total attempts
  - **Students**: Attempted quizzes, enrolled classes, total/average scores

### System Data
- **GET** `/api/user/grades` - Get available grade levels
- **GET** `/api/user/subjects` - Get available subjects with question counts

## Setup Instructions

### 1. Import Collection
1. Open Postman
2. Click "Import" 
3. Select either collection file
4. The collection will be imported with all requests and documentation

### 2. Configure Environment Variables
Set the following collection variables:
- `baseUrl`: `http://localhost:3001/api` (default)
- `authToken`: Your JWT token (get from login endpoint)

### 3. Get Authentication Token
Before using User Management APIs:
1. Use the authentication endpoints to login
2. Copy the JWT token from the login response
3. Set it in the `authToken` collection variable

## Features

### ✅ Complete Documentation
- Detailed descriptions for each endpoint
- Request/response examples
- Parameter explanations
- Use case descriptions

### ✅ Test Automation
- Automated tests for response validation
- Status code verification
- Response structure validation
- Global error handling

### ✅ Sample Data
- Realistic request bodies
- Multiple response examples
- Error response samples

### ✅ Environment Ready
- Configurable base URL
- Token-based authentication
- Pre-request scripts for validation

## Request Examples

### Get User Profile
```http
GET {{baseUrl}}/user/profile
Authorization: Bearer {{authToken}}
```

### Update User Profile
```http
PUT {{baseUrl}}/user/profile
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "name": "John Doe Updated",
  "email": "john.updated@example.com"
}
```

### Change Password
```http
PUT {{baseUrl}}/user/password
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```

## Response Examples

### User Profile Response
```json
{
  "user": {
    "id": "user-uuid-here",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "TEACHER",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-02-01T14:22:00.000Z"
  }
}
```

### Teacher Statistics Response
```json
{
  "stats": {
    "quizzes": 15,
    "students": 42,
    "classes": 3,
    "totalAttempts": 127
  }
}
```

### Student Statistics Response
```json
{
  "stats": {
    "attemptedQuizzes": 23,
    "classes": 2,
    "totalScore": 1450,
    "averageScore": 78
  }
}
```

## Error Handling

The collection includes automatic handling for:
- **401 Unauthorized**: Invalid or missing auth token
- **403 Forbidden**: Insufficient permissions
- **400 Bad Request**: Invalid request data
- **500 Server Error**: Backend issues

## Testing

Each request includes automated tests that verify:
- Response status codes
- Response structure
- Required fields presence
- Data type validation

## Notes

- All endpoints require JWT authentication
- Statistics are calculated in real-time from the database
- Subjects are dynamically generated from existing questions
- Password changes require current password verification
- Email updates check for uniqueness

## Support

For issues or questions:
1. Check the backend server logs
2. Verify authentication token validity
3. Ensure the backend server is running on the correct port
4. Review the API documentation in each request
