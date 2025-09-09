// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./DAO.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract DAOFactory is Ownable {
    //~~~~ State variables ~~~~
    address public templateDAO;
    address public semaphoreContract;
    address[] public daosCreated;

    event NewClone(address indexed _instance);

    constructor(address template, address _semaphore) {
        templateDAO = template;
        semaphoreContract = _semaphore;
    }

    function createDAO() public onlyOwner returns (address) {
        address clone = Clones.clone(templateDAO);
        DAO(clone).initialize(msg.sender, semaphoreContract);
        daosCreated.push(clone);
        emit NewClone(clone);

        return clone;
    }

    //~~~~ Extra Functions ~~~~
    function getDaosCount() external view returns (uint256) {
        return daosCreated.length;
    }

    function getDao(uint256 index) external view returns (address) {
        require(index < daosCreated.length, "Index out of bounds");
        return daosCreated[index];
    }
}
