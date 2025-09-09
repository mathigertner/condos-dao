// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./DAO.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@semaphore-protocol/contracts/Semaphore.sol";
import "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";

contract DAOFactory is Ownable {
    //~~~~ State variables ~~~~
    address public templateDAO;
    address public semaphoreContract;
    address[] public daosCreated;

    event NewClone(address indexed _instance);
    event NewSemaphore(address indexed _semaphore);

    constructor(address template) {
        templateDAO = template;
        SemaphoreVerifier verifier = new SemaphoreVerifier();
        Semaphore semaphore = new Semaphore(
            ISemaphoreVerifier(address(verifier))
        );
        semaphoreContract = address(semaphore);

        emit NewSemaphore(semaphoreContract);
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
